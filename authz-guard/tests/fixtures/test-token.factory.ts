import * as jose from 'jose';
import { getTestKeys, TEST_ISSUER, TEST_AUDIENCE, TEST_KID } from './test-keys.js';

export interface TokenCreationOptions {
  userId?: string;
  issuer?: string;
  audience?: string | string[];
  expiresIn?: string | number;
  customClaims?: Record<string, unknown>;
  kid?: string;
}

export class TestTokenFactory {
  /**
   * Generates a cryptographically valid test JWT access token signed by the local test key.
   */
  public static async createValidToken(options: TokenCreationOptions = {}): Promise<string> {
    const { privateKey } = await getTestKeys();
    const userId = options.userId || 'user123';
    const issuer = options.issuer || TEST_ISSUER;
    const audience = options.audience || TEST_AUDIENCE;
    const expiresIn = options.expiresIn ?? '1h';

    return new jose.SignJWT({
      sub: userId,
      scope: 'openid profile email',
      ...options.customClaims
    })
      .setProtectedHeader({ alg: 'RS256', kid: options.kid || TEST_KID, typ: 'JWT' })
      .setIssuedAt()
      .setIssuer(issuer)
      .setAudience(audience)
      .setExpirationTime(expiresIn)
      .sign(privateKey);
  }

  /**
   * Generates an expired test token.
   */
  public static async createExpiredToken(userId = 'user123'): Promise<string> {
    const { privateKey } = await getTestKeys();

    return new jose.SignJWT({ sub: userId })
      .setProtectedHeader({ alg: 'RS256', kid: TEST_KID, typ: 'JWT' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setIssuer(TEST_ISSUER)
      .setAudience(TEST_AUDIENCE)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1800) // expired 30 mins ago
      .sign(privateKey);
  }

  /**
   * Generates a token with an untrusted / mismatched issuer.
   */
  public static async createWrongIssuerToken(userId = 'user123'): Promise<string> {
    return this.createValidToken({
      userId,
      issuer: 'https://attacker-idp.example.com'
    });
  }

  /**
   * Generates a token with an untrusted / mismatched audience.
   */
  public static async createWrongAudienceToken(userId = 'user123'): Promise<string> {
    return this.createValidToken({
      userId,
      audience: 'https://other-service.example.com'
    });
  }

  /**
   * Generates a token signed by an unknown / untrusted foreign key pair.
   */
  public static async createUntrustedSignatureToken(userId = 'user123'): Promise<string> {
    const { privateKey } = await jose.generateKeyPair('RS256');

    return new jose.SignJWT({ sub: userId })
      .setProtectedHeader({ alg: 'RS256', kid: 'rogue-key-99', typ: 'JWT' })
      .setIssuedAt()
      .setIssuer(TEST_ISSUER)
      .setAudience(TEST_AUDIENCE)
      .setExpirationTime('1h')
      .sign(privateKey);
  }

  /**
   * Generates a token missing the subject (sub) claim.
   */
  public static async createMissingSubjectToken(): Promise<string> {
    const { privateKey } = await getTestKeys();

    return new jose.SignJWT({ email: 'user@example.com' })
      .setProtectedHeader({ alg: 'RS256', kid: TEST_KID, typ: 'JWT' })
      .setIssuedAt()
      .setIssuer(TEST_ISSUER)
      .setAudience(TEST_AUDIENCE)
      .setExpirationTime('1h')
      .sign(privateKey);
  }
}
