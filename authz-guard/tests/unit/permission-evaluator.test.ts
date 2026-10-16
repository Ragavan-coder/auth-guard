import { describe, it, expect } from 'vitest';
import { PermissionEvaluatorService } from '../../src/services/permission-evaluator.service.js';
import { PolicyRule } from '../../src/domain/policy.types.js';

describe('Permission Evaluator Service', () => {
  const evaluator = new PermissionEvaluatorService();

  it('returns default DENY with NO_MATCHING_POLICY when no rules match', () => {
    const result = evaluator.evaluate('user123', 'read', 'transactions', []);

    expect(result.decision).toBe('DENY');
    expect(result.reasonCode).toBe('NO_MATCHING_POLICY');
    expect(result.matchedPermissions).toHaveLength(0);
  });

  it('resolves equal-specificity conflict using explicit deny precedence', () => {
    const policies: PolicyRule[] = [
      { id: 1, userId: 'user1', action: 'write', resource: 'wallets/w-1', effect: 'allow' },
      { id: 2, userId: 'user1', action: 'write', resource: 'wallets/w-1', effect: 'deny' }
    ];

    const result = evaluator.evaluate('user1', 'write', 'wallets/w-1', policies);

    expect(result.decision).toBe('DENY');
    expect(result.reasonCode).toBe('EXPLICIT_DENY');
    // Matched permissions should report the deny rule
    expect(result.matchedPermissions.some((p) => p.effect === 'deny')).toBe(true);
  });

  it('allows a more-specific allow to override an inherited collection deny', () => {
    const policies: PolicyRule[] = [
      // Broad collection deny
      { id: 1, userId: 'user1', action: 'delete', resource: 'transactions', effect: 'deny' },
      // Specific item allow
      {
        id: 2,
        userId: 'user1',
        action: 'delete',
        resource: 'transactions/txn-123',
        effect: 'allow'
      }
    ];

    const result = evaluator.evaluate('user1', 'delete', 'transactions/txn-123', policies);

    expect(result.decision).toBe('ALLOW');
    expect(result.reasonCode).toBe('POLICY_ALLOW');
    expect(result.matchedPermissions).toHaveLength(1);
    expect(result.matchedPermissions[0]?.id).toBe(2);
  });

  it('allows a more-specific deny to override a broader inherited allow', () => {
    const policies: PolicyRule[] = [
      // Broad wildcard allow
      { id: 1, userId: 'user1', action: 'read', resource: 'wallets/*', effect: 'allow' },
      // Exact entity deny
      { id: 2, userId: 'user1', action: 'read', resource: 'wallets/blocked-wallet', effect: 'deny' }
    ];

    const result = evaluator.evaluate('user1', 'read', 'wallets/blocked-wallet', policies);

    expect(result.decision).toBe('DENY');
    expect(result.reasonCode).toBe('EXPLICIT_DENY');
    expect(result.matchedPermissions).toHaveLength(1);
    expect(result.matchedPermissions[0]?.id).toBe(2);
  });

  it('applies inherited collection denial with INHERITED_DENY reason code', () => {
    const policies: PolicyRule[] = [
      { id: 1, userId: 'user1', action: 'delete', resource: 'transactions', effect: 'deny' }
    ];

    const result = evaluator.evaluate('user1', 'delete', 'transactions/txn-456', policies);

    expect(result.decision).toBe('DENY');
    expect(result.reasonCode).toBe('INHERITED_DENY');
    expect(result.matchedPermissions).toHaveLength(1);
    expect(result.matchedPermissions[0]?.id).toBe(1);
  });

  it('only returns policies that determine the final result in matched_permissions', () => {
    const policies: PolicyRule[] = [
      { id: 1, userId: 'user1', action: 'read', resource: '*', effect: 'allow' },
      { id: 2, userId: 'user1', action: 'read', resource: 'wallets/*', effect: 'allow' },
      {
        id: 3,
        userId: 'user1',
        action: 'read',
        resource: 'wallets/wallet-789/transactions',
        effect: 'allow'
      }
    ];

    const result = evaluator.evaluate('user1', 'read', 'wallets/wallet-789/transactions', policies);

    expect(result.decision).toBe('ALLOW');
    // Only the highest specificity policy (id: 3) determined the result
    expect(result.matchedPermissions).toHaveLength(1);
    expect(result.matchedPermissions[0]?.id).toBe(3);
  });
});
