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

    // 4. Retrieve applicable permissions from SQLite
    const secondaryId = typeof identity.claims['email'] === 'string' ? identity.claims['email'] : undefined;
    const policies = this.permissionRepo.findByUserAndAction(userId, action, secondaryId);

    // 5. Evaluate policy rules with deterministic specificity and explicit-deny precedence
    const evaluation = this.permissionEvaluator.evaluate(
      userId,
      action,
      canonicalResource,
      policies
    );

    // 6. Record structured audit event
    const matchedPolicyIds = evaluation.matchedPermissions.map((p) => p.id);
    this.auditService.recordDecision({
      requestId,
      userId,
      action,
      resource: canonicalResource,
      decision: evaluation.decision,
      reasonCode: evaluation.reasonCode,
      matchedPolicyIds
    });

    // 7. Format successful authorization evaluation response
    return {
      decision: evaluation.decision,
      user_id: userId,
      action,
      resource: canonicalResource,
      reason_code: evaluation.reasonCode,
      reason: evaluation.reason,
      matched_permissions: evaluation.matchedPermissions,
      request_id: requestId
    };
  }
}
