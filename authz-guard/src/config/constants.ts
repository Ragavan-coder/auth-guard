/**
 * Shared authorization actions, decisions, and non-secret constants.
 */

export const ACTIONS = {
  READ: 'read',
  WRITE: 'write',
  DELETE: 'delete'
} as const;

export const DECISIONS = {
  ALLOW: 'ALLOW',
  DENY: 'DENY'
} as const;

export const EFFECTS = {
  ALLOW: 'allow',
  DENY: 'deny'
} as const;

export const REASON_CODES = {
  POLICY_ALLOW: 'POLICY_ALLOW',
  POLICY_DENY: 'POLICY_DENY',
  EXPLICIT_DENY: 'EXPLICIT_DENY',
  INHERITED_DENY: 'INHERITED_DENY',
  NO_MATCHING_POLICY: 'NO_MATCHING_POLICY',
  INVALID_TOKEN: 'INVALID_TOKEN',
  INVALID_REQUEST: 'INVALID_REQUEST',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;

export const ALLOWED_JWT_ALGORITHMS = [
  'RS256',
  'RS384',
  'RS512',
  'ES256',
  'ES384',
  'ES512',
  'EdDSA'
] as const;

export const DEFAULT_MAX_BODY_BYTES = 16 * 1024; // 16 KB
export const DEFAULT_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
export const DEFAULT_RATE_LIMIT_MAX = 100; // 100 requests / minute
