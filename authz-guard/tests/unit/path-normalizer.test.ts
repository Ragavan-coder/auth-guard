import { describe, it, expect } from 'vitest';
import { normalizeResourcePath } from '../../src/utils/path-normalizer.js';
import { InvalidRequestError } from '../../src/domain/authorization.errors.js';

describe('Path Normalizer Utility', () => {
  it('normalizes valid origin-form absolute paths into canonical resource identifiers', () => {
    expect(normalizeResourcePath('/transactions')).toBe('transactions');
    expect(normalizeResourcePath('/transactions/')).toBe('transactions');
    expect(normalizeResourcePath('/transactions/txn-123')).toBe('transactions/txn-123');
    expect(normalizeResourcePath('/wallets/wallet-789/transactions')).toBe(
      'wallets/wallet-789/transactions'
    );
    expect(normalizeResourcePath('/wallets/wallet-789/transactions/txn-456')).toBe(
      'wallets/wallet-789/transactions/txn-456'
    );
  });

  it('handles root path', () => {
    expect(normalizeResourcePath('/')).toBe('');
  });

  it('rejects paths without leading slash', () => {
    expect(() => normalizeResourcePath('transactions')).toThrow(InvalidRequestError);
    expect(() => normalizeResourcePath('wallets/123')).toThrow(InvalidRequestError);
  });

  it('rejects path traversal attempts including dot segments and encoded variants', () => {
    const traversalPaths = [
      '/../admin',
      '/wallets/../transactions',
      '/wallets/./transactions',
      '/wallets/%2e%2e/transactions',
      '/wallets/%2e/transactions',
      '/wallets/..%2fadmin',
      '/transactions/..',
      '/transactions/.'
    ];

    for (const p of traversalPaths) {
      expect(() => normalizeResourcePath(p)).toThrow(InvalidRequestError);
    }
  });

  it('rejects query strings and URL fragments', () => {
    expect(() => normalizeResourcePath('/transactions?id=123')).toThrow(InvalidRequestError);
    expect(() => normalizeResourcePath('/transactions#section')).toThrow(InvalidRequestError);
  });

  it('rejects backslashes and duplicate slashes', () => {
    expect(() => normalizeResourcePath('/wallets\\wallet-1')).toThrow(InvalidRequestError);
    expect(() => normalizeResourcePath('/wallets//transactions')).toThrow(InvalidRequestError);
  });

  it('rejects encoded path separators (%2f and %5c)', () => {
    expect(() => normalizeResourcePath('/wallets%2ftransactions')).toThrow(InvalidRequestError);
    expect(() => normalizeResourcePath('/wallets%2Ftransactions')).toThrow(InvalidRequestError);
    expect(() => normalizeResourcePath('/wallets%5cadmin')).toThrow(InvalidRequestError);
  });

  it('rejects malformed percent encodings', () => {
    expect(() => normalizeResourcePath('/wallets/%ZZ')).toThrow(InvalidRequestError);
    expect(() => normalizeResourcePath('/wallets/%')).toThrow(InvalidRequestError);
    expect(() => normalizeResourcePath('/wallets/%1')).toThrow(InvalidRequestError);
  });

  it('rejects control characters', () => {
    expect(() => normalizeResourcePath('/wallets/\x00admin')).toThrow(InvalidRequestError);
    expect(() => normalizeResourcePath('/wallets/\x1f')).toThrow(InvalidRequestError);
    expect(() => normalizeResourcePath('/wallets/\x7f')).toThrow(InvalidRequestError);
  });

  it('rejects paths exceeding maximum length', () => {
    const longPath = '/' + 'a'.repeat(2049);
    expect(() => normalizeResourcePath(longPath)).toThrow(InvalidRequestError);
  });
});
