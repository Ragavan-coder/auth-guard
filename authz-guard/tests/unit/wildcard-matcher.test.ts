import { describe, it, expect } from 'vitest';
import { matchResource } from '../../src/utils/wildcard-matcher.js';

describe('Wildcard and Hierarchical Matcher Utility', () => {
  it('matches global wildcard against any valid resource path', () => {
    expect(matchResource('*', 'transactions')).toBe(true);
    expect(matchResource('*', 'wallets/wallet-1')).toBe(true);
    expect(matchResource('*', 'wallets/wallet-1/transactions/txn-1')).toBe(true);
    expect(matchResource('*', 'accounts/acc-1/settings')).toBe(true);
  });

  it('matches literal top-level collection inheritance to descendants', () => {
    expect(matchResource('transactions', 'transactions')).toBe(true);
    expect(matchResource('transactions', 'transactions/txn-123')).toBe(true);
    expect(matchResource('transactions', 'transactions/txn-123/items')).toBe(true);
    expect(matchResource('transactions', 'accounts/transactions')).toBe(false);
    expect(matchResource('accounts', 'accounts/acc-1')).toBe(true);
  });

  it('matches literal multi-segment entity strictly against itself without wildcard', () => {
    expect(matchResource('wallets/wallet-789', 'wallets/wallet-789')).toBe(true);
    // Multi-segment entity without terminal /* does not match sub-resources
    expect(matchResource('wallets/wallet-789', 'wallets/wallet-789/transactions')).toBe(false);
  });

  it('matches terminal /* wildcard against single and multiple trailing segments', () => {
    expect(matchResource('wallets/*', 'wallets/wallet-789')).toBe(true);
    expect(matchResource('wallets/*', 'wallets/wallet-789/transactions')).toBe(true);
    expect(matchResource('wallets/*', 'wallets/wallet-789/transactions/txn-1')).toBe(true);
    expect(matchResource('wallets/*', 'accounts/wallet-789')).toBe(false);
  });

  it('matches internal wildcards and zero-or-more terminal wildcards as documented in specification', () => {
    // 1. wallets/* -> wallets/wallet-789 (matches: true)
    expect(matchResource('wallets/*', 'wallets/wallet-789')).toBe(true);

    // 2. wallets/* -> wallets/wallet-789/transactions (matches: true)
    expect(matchResource('wallets/*', 'wallets/wallet-789/transactions')).toBe(true);

    // 3. wallets/*/transactions/* -> wallets/wallet-789/transactions (matches: true - zero trailing segments)
    expect(matchResource('wallets/*/transactions/*', 'wallets/wallet-789/transactions')).toBe(true);

    // 4. wallets/*/transactions/* -> wallets/wallet-789/transactions/txn-999 (matches: true - one trailing segment)
    expect(
      matchResource('wallets/*/transactions/*', 'wallets/wallet-789/transactions/txn-999')
    ).toBe(true);

    // 5. wallets/*/transactions/* -> wallets/wallet-789/accounts (matches: false)
    expect(matchResource('wallets/*/transactions/*', 'wallets/wallet-789/accounts')).toBe(false);

    // 6. transactions -> accounts/transactions (matches: false)
    expect(matchResource('transactions', 'accounts/transactions')).toBe(false);
  });

  it('enforces internal wildcard matching exactly one segment', () => {
    expect(matchResource('wallets/*/transactions', 'wallets/w-1/transactions')).toBe(true);
    expect(matchResource('wallets/*/transactions', 'wallets/w-1/sub/transactions')).toBe(false);
  });

  it('handles invalid or empty inputs safely', () => {
    expect(matchResource('', 'transactions')).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(matchResource(null as any, 'transactions')).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(matchResource('transactions', null as any)).toBe(false);
  });
});
