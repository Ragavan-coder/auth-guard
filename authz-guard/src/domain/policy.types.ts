import { Action, Decision, Effect, MatchedPermission } from './authorization.types.js';

export interface PolicyRule {
  id: number;
  userId: string;
  action: Action;
  resource: string;
  effect: Effect;
}

export interface SpecificityScore {
  /**
   * Scope Tier:
   * 4 = Exact literal match (resource === pattern, no wildcards)
   * 3 = Narrow/Terminal wildcard pattern (e.g. wallets/* or wallets/ * /transactions/ *)
   * 2 = Literal collection inheritance (e.g. 'transactions' matching 'transactions/txn-123')
   * 1 = Global wildcard ('*')
   */
  scopeTier: number;
  fixedSegments: number;
  wildcardSegments: number;
  patternDepth: number;
}

export interface PolicyMatchResult {
  policy: PolicyRule;
  matches: boolean;
  score: SpecificityScore;
}

export interface PolicyEvaluationResult {
  decision: Decision;
  reasonCode: string;
  reason: string;
  matchedPermissions: MatchedPermission[];
}
