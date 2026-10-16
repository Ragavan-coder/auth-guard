import type { JWTPayload } from 'jose';

export interface ValidatedIdentity {
  userId: string;
  issuer: string;
  audience: string | string[];
  claims: JWTPayload;
}
