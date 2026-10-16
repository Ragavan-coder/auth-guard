import { Action, MatchedPermission } from '../domain/authorization.types.js';
import { PolicyRule, PolicyEvaluationResult, PolicyMatchResult } from '../domain/policy.types.js';
import { matchResource } from '../utils/wildcard-matcher.js';
import { calculateSpecificity, compareSpecificity } from '../utils/policy-specificity.js';
import { DECISIONS, REASON_CODES } from '../config/constants.js';

export class PermissionEvaluatorService {
  /**
   * Pure deterministic policy evaluation.
   * Independent of Express, HTTP transport, and database mechanics.
   */
  public evaluate(
    _userId: string,
    action: Action,
    resource: string,
    policies: PolicyRule[]
  ): PolicyEvaluationResult {
    // 1. Identify all applicable policies that match action and canonical resource
    const candidateMatches: PolicyMatchResult[] = [];

    for (const policy of policies) {
      if (policy.action === action || (policy.action as string) === '*') {
        if (matchResource(policy.resource, resource)) {
          const score = calculateSpecificity(policy.resource, resource);
          candidateMatches.push({
            policy,
            matches: true,
            score
          });
        }
      }
    }

    // 2. Default deny if no policies match
    if (candidateMatches.length === 0) {
      return {
        decision: DECISIONS.DENY,
        reasonCode: REASON_CODES.NO_MATCHING_POLICY,
        reason:
          'No matching authorization policy exists for the requested user, action, and resource.',
        matchedPermissions: []
      };
    }

    // 3. Find highest applicable specificity among matching policies
    let bestScore = candidateMatches[0]!.score;
    for (let i = 1; i < candidateMatches.length; i++) {
      const currentScore = candidateMatches[i]!.score;
      if (compareSpecificity(currentScore, bestScore) > 0) {
        bestScore = currentScore;
      }
    }

    // 4. Filter candidates down to those matching the highest applicable specificity
    const topTierCandidates = candidateMatches.filter(
      (candidate) => compareSpecificity(candidate.score, bestScore) === 0
    );

    // 5. Evaluate Deny Precedence at highest applicable specificity
    const denyRules = topTierCandidates.filter((c) => c.policy.effect === 'deny');
    const allowRules = topTierCandidates.filter((c) => c.policy.effect === 'allow');

    // Deterministic reporting: sort winning matched permissions by id ASC
    const winningPolicies = (denyRules.length > 0 ? denyRules : allowRules).map(
      (c): MatchedPermission => ({
        id: c.policy.id,
        action: c.policy.action,
        resource: c.policy.resource,
        effect: c.policy.effect
      })
    );
    winningPolicies.sort((a, b) => a.id - b.id);

    if (denyRules.length > 0) {
      // Determine if deny was inherited or explicit exact match
      const reasonCode =
        bestScore.scopeTier === 2 ? REASON_CODES.INHERITED_DENY : REASON_CODES.EXPLICIT_DENY;
      const reasonMessage =
        bestScore.scopeTier === 2
          ? 'Inherited explicit delete denial applies at highest applicable specificity.'
          : 'An explicit deny policy takes precedence at the highest applicable specificity.';

      return {
        decision: DECISIONS.DENY,
        reasonCode,
        reason: reasonMessage,
        matchedPermissions: winningPolicies
      };
    }

    if (allowRules.length > 0) {
      return {
        decision: DECISIONS.ALLOW,
        reasonCode: REASON_CODES.POLICY_ALLOW,
        reason: 'A matching allow policy applies at the highest applicable specificity.',
        matchedPermissions: winningPolicies
      };
    }

    // Fail closed fallback (e.g. invalid or empty effect values)
    return {
      decision: DECISIONS.DENY,
      reasonCode: REASON_CODES.POLICY_DENY,
      reason: 'Failed to evaluate policies reliably. Access denied by default.',
      matchedPermissions: []
    };
  }
}
