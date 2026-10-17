import { AuthorizeRequestBody, AuthorizeSuccessResponse } from '../domain/authorization.types.js';
import { TokenValidationService } from './token-validation.service.js';
import { ResourceResolverService } from './resource-resolver.service.js';
import { PermissionEvaluatorService } from './permission-evaluator.service.js';
import { PermissionRepository } from '../repositories/permission.repository.js';
import { AuditService } from './audit.service.js';
import { mapHttpMethodToAction } from '../utils/http-method.mapper.js';

export class AuthorizeService {
  constructor(
    private tokenValidator: TokenValidationService = new TokenValidationService(),
    private resourceResolver: ResourceResolverService = new ResourceResolverService(),
    private permissionEvaluator: PermissionEvaluatorService = new PermissionEvaluatorService(),
    private permissionRepo: PermissionRepository = new PermissionRepository(),
    private auditService: AuditService = new AuditService()
  ) {}

  public async execute(
    request: AuthorizeRequestBody,
    requestId: string
  ): Promise<AuthorizeSuccessResponse> {
    // 1. Validate JWT access token and extract authenticated subject
    const identity = await this.tokenValidator.validateToken(request.access_token);
    const userId = identity.userId;

    // 2. Map HTTP method to authorization action
    const action = mapHttpMethodToAction(request.method);

    // 3. Normalize requested path to canonical resource identifier
    const canonicalResource = this.resourceResolver.resolve(request.path);

    // 4. Retrieve applicable permissions from SQLite across all identity aliases
    const secondaryId = typeof identity.claims['email'] === 'string' ? identity.claims['email'] : undefined;
    const userAliases = new Set<string>();
    if (userId) userAliases.add(userId);
    if (secondaryId) userAliases.add(secondaryId);
    if (typeof identity.claims['username'] === 'string') userAliases.add(identity.claims['username']);
    if (typeof identity.claims['name'] === 'string') userAliases.add(identity.claims['name']);

    let resolvedUsername = typeof identity.claims['username'] === 'string' ? identity.claims['username'] : undefined;
    let resolvedEmail = secondaryId;

    try {
      const { UserRepository } = await import('../repositories/user.repository.js');
      const userRepo = new UserRepository();
      const numId = parseInt(userId, 10);
      let matchedUser = Number.isFinite(numId) ? userRepo.findById(numId) : null;
      if (!matchedUser && secondaryId) {
        matchedUser = userRepo.findByEmail(secondaryId);
      }
      if (!matchedUser && identity.claims['username']) {
        matchedUser = userRepo.findByUsername(String(identity.claims['username']));
      }
      if (matchedUser) {
        userAliases.add(String(matchedUser.id));
        userAliases.add(matchedUser.username);
        userAliases.add(matchedUser.email);
        if (!resolvedUsername) resolvedUsername = matchedUser.username;
        if (!resolvedEmail) resolvedEmail = matchedUser.email;
      }
    } catch {
      // non-blocking
    }

    const policies = this.permissionRepo.findByUserAndAction(Array.from(userAliases), action);

    // 5. Evaluate policy rules with deterministic specificity and explicit-deny precedence
    const evaluation = this.permissionEvaluator.evaluate(
      userId,
      action,
      canonicalResource,
      policies
    );

    // 6. Record structured audit event
    const matchedPolicyIds = evaluation.matchedPermissions.map((p) => p.id);
    const auditUserId = resolvedUsername || resolvedEmail || userId;
    this.auditService.recordDecision({
      requestId,
      userId: auditUserId,
      action,
      resource: canonicalResource,
      decision: evaluation.decision,
      reasonCode: evaluation.reasonCode,
      matchedPolicyIds
    });

    // 7. Format successful authorization evaluation response
    return {
      decision: evaluation.decision,
      user_id: auditUserId,
      action,
      resource: canonicalResource,
      reason_code: evaluation.reasonCode,
      reason: evaluation.reason,
      matched_permissions: evaluation.matchedPermissions,
      request_id: requestId
    };
  }
}
