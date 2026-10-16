import { describe, it, expect } from 'vitest';
import { calculateSpecificity, compareSpecificity } from '../../src/utils/policy-specificity.js';

describe('Policy Specificity Ranking Utility', () => {
  const target = 'wallets/wallet-789/transactions';

  it('ranks exact literal match higher than wildcard and collection inheritance', () => {
    const exact = calculateSpecificity('wallets/wallet-789/transactions', target);
    const wildcardNarrow = calculateSpecificity('wallets/*/transactions/*', target);
    const wildcardBroad = calculateSpecificity('wallets/*', target);
    const globalWildcard = calculateSpecificity('*', target);

    expect(compareSpecificity(exact, wildcardNarrow)).toBeGreaterThan(0);
    expect(compareSpecificity(exact, wildcardBroad)).toBeGreaterThan(0);
    expect(compareSpecificity(exact, globalWildcard)).toBeGreaterThan(0);
  });

  it('ranks narrower wildcard with more fixed segments higher than broader wildcard', () => {
    const narrow = calculateSpecificity('wallets/*/transactions/*', target);
    const broad = calculateSpecificity('wallets/*', target);

    // wallets/*/transactions/* has 2 fixed segments; wallets/* has 1
    expect(compareSpecificity(narrow, broad)).toBeGreaterThan(0);
  });

  it('ranks literal exact match higher than literal collection inheritance', () => {
    const targetItem = 'transactions/txn-123';
    const exactMatch = calculateSpecificity('transactions/txn-123', targetItem);
    const inheritedCollection = calculateSpecificity('transactions', targetItem);

    // Exact literal (scopeTier 4) outranks collection inheritance (scopeTier 2)
    expect(compareSpecificity(exactMatch, inheritedCollection)).toBeGreaterThan(0);
  });

  it('ranks collection inheritance higher than global wildcard', () => {
    const targetItem = 'transactions/txn-123';
    const inheritedCollection = calculateSpecificity('transactions', targetItem);
    const globalWildcard = calculateSpecificity('*', targetItem);

    expect(compareSpecificity(inheritedCollection, globalWildcard)).toBeGreaterThan(0);
  });

  it('detects equal specificity for identical pattern structures', () => {
    const patternA = calculateSpecificity('transactions', 'transactions');
    const patternB = calculateSpecificity('transactions', 'transactions');

    expect(compareSpecificity(patternA, patternB)).toBe(0);
  });
});
