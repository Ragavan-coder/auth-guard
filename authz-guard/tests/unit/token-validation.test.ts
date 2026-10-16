import { describe, it, expect, beforeAll } from 'vitest';
import { TokenValidationService } from '../../src/services/token-validation.service.js';
import { getTestKeys, TEST_ISSUER, TEST_AUDIENCE } from '../fixtures/test-keys.js';
import { TestTokenFactory } from '../fixtures/test-token.factory.js';
import { InvalidTokenError } from '../../src/domain/authorization.errors.js';

describe('Token Validation Service', () => {
  let tokenValidator: TokenValidationService;

  beforeAll(async () => {
    const { localKeyStore } = await getTestKeys();
    tokenValidator = new TokenValidationService({
      keyStore: localKeyStore,
      issuer: TEST_ISSUER,
      audience: TEST_AUDIENCE
    });
  });

  it('successfully validates a valid signed token and returns identity', async () => {
    const token = await TestTokenFactory.createValidToken({ userId: 'user123' });
    const identity = await tokenValidator.validateToken(token);

    expect(identity.userId).toBe('user123');
    expect(identity.issuer).toBe(TEST_ISSUER);
    expect(identity.audience).toBe(TEST_AUDIENCE);
    expect(identity.claims.sub).toBe('user123');
  });

  it('rejects expired tokens with InvalidTokenError', async () => {
    const expiredToken = await TestTokenFactory.createExpiredToken('user123');

    await expect(tokenValidator.validateToken(expiredToken)).rejects.toThrow(InvalidTokenError);
    try {
      await tokenValidator.validateToken(expiredToken);
    } catch (err) {
      expect((err as InvalidTokenError).statusCode).toBe(401);
      expect((err as InvalidTokenError).errorCode).toBe('INVALID_TOKEN');
      // Ensure safe message
      expect((err as InvalidTokenError).safeMessage).toBe(
        'The provided access token is invalid, expired, or untrusted.'
      );
    }
  });

  it('rejects tokens with mismatched issuer', async () => {
    const wrongIssuerToken = await TestTokenFactory.createWrongIssuerToken('user123');
    await expect(tokenValidator.validateToken(wrongIssuerToken)).rejects.toThrow(InvalidTokenError);
  });

  it('rejects tokens with mismatched audience', async () => {
    const wrongAudienceToken = await TestTokenFactory.createWrongAudienceToken('user123');
    await expect(tokenValidator.validateToken(wrongAudienceToken)).rejects.toThrow(
      InvalidTokenError
    );
  });

  it('rejects tokens signed by an untrusted key', async () => {
    const rogueToken = await TestTokenFactory.createUntrustedSignatureToken('user123');
    await expect(tokenValidator.validateToken(rogueToken)).rejects.toThrow(InvalidTokenError);
  });

  it('rejects tokens missing the subject claim', async () => {
    const noSubToken = await TestTokenFactory.createMissingSubjectToken();
    await expect(tokenValidator.validateToken(noSubToken)).rejects.toThrow(InvalidTokenError);
  });

  it('rejects malformed string tokens', async () => {
    await expect(tokenValidator.validateToken('not-a-jwt')).rejects.toThrow(InvalidTokenError);
    await expect(tokenValidator.validateToken('a.b.c')).rejects.toThrow(InvalidTokenError);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(tokenValidator.validateToken('' as any)).rejects.toThrow(InvalidTokenError);
  });
});
