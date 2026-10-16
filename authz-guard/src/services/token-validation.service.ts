import * as jose from 'jose';
import { getEnv } from '../config/env.js';
import { ALLOWED_JWT_ALGORITHMS } from '../config/constants.js';
import { ValidatedIdentity } from '../domain/token.types.js';
import { InvalidTokenError } from '../domain/authorization.errors.js';
import { logger } from '../utils/logger.js';

export interface TokenValidationOptions {
  keyStore?: jose.JWTVerifyGetKey;
  issuer?: string;
  audience?: string;
  jwksUrl?: string;
}

export class TokenValidationService {
  private remoteJwks: jose.JWTVerifyGetKey | null = null;
  private customJwks: jose.JWTVerifyGetKey | null = null;
  private readonly issuer: string;
  private readonly audience: string;

  constructor(options: TokenValidationOptions = {}) {
    if (options.issuer && options.audience) {
      this.issuer = options.issuer;
      this.audience = options.audience;
    } else {
      const env = getEnv();
      this.issuer = options.issuer || env.OIDC_ISSUER_URL;
      this.audience = options.audience || env.OIDC_AUDIENCE;
    }

    if (options.keyStore) {
      this.customJwks = options.keyStore;
    } else {
      let jwksUri = options.jwksUrl;
      if (!jwksUri) {
        try {
          const env = getEnv();
          jwksUri = env.OIDC_JWKS_URL || `${this.issuer.replace(/\/$/, '')}/.well-known/jwks.json`;
        } catch {
          jwksUri = `${this.issuer.replace(/\/$/, '')}/.well-known/jwks.json`;
        }
      }

      try {
        this.remoteJwks = jose.createRemoteJWKSet(new URL(jwksUri), {
          cacheMaxAge: 10 * 60 * 1000,
          cooldownDuration: 30 * 1000
        });
      } catch (err) {
        logger.warn(
          { err },
          'Remote JWKS set unavailable. Local mock or runtime set may be injected.'
        );
      }
    }
  }

  public setKeyStore(keyStore: jose.JWTVerifyGetKey): void {
    this.customJwks = keyStore;
  }

  public async validateToken(token: string): Promise<ValidatedIdentity> {
    if (!token || typeof token !== 'string') {
      throw new InvalidTokenError('Access token is missing or has an invalid type.');
    }

    // 1. Attempt verification as a local auth session token
    try {
      const { LocalAuthService } = await import('./local-auth.service.js');
      const localAuth = new LocalAuthService();
      const localClaims = await localAuth.verifyToken(token);
      if (localClaims && localClaims.sub) {
        return {
          userId: localClaims.sub,
          issuer: 'authz-guard-local',
          audience: 'authz-guard',
          claims: localClaims as unknown as Record<string, unknown>
        };
      }
    } catch {
      // Continue to OIDC / JWKS verification
    }

    const keySet = this.customJwks || this.remoteJwks;
    if (!keySet) {
      logger.error('No JWKS key set available for token validation.');
      throw new InvalidTokenError('Token verification unavailable.');
    }

    try {
      const { payload } = await jose.jwtVerify(token, keySet, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: [...ALLOWED_JWT_ALGORITHMS]
      });

      if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.trim() === '') {
        logger.warn('Token missing or has invalid subject (sub) claim.');
        throw new InvalidTokenError('Token subject claim is invalid.');
      }

      return {
        userId: payload.sub,
        issuer: typeof payload.iss === 'string' ? payload.iss : this.issuer,
        audience: payload.aud ?? this.audience,
        claims: payload
      };
    } catch (err) {
      if (err instanceof InvalidTokenError) {
        throw err;
      }
      logger.debug({ errorName: (err as Error)?.name }, 'JWT verification failed.');
      throw new InvalidTokenError('The provided access token is invalid, expired, or untrusted.');
    }
  }
}
