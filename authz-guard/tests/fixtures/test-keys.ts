import * as jose from 'jose';

export const TEST_ISSUER = 'https://test-issuer.authz-guard.internal';
export const TEST_AUDIENCE = 'https://test-api.authz-guard.internal';
export const TEST_KID = 'test-rsa-key-1';

let cachedPrivateKey: jose.KeyLike | null = null;
let cachedPublicKey: jose.KeyLike | null = null;
let cachedJwks: { keys: jose.JWK[] } | null = null;
let cachedLocalKeyStore: jose.JWTVerifyGetKey | null = null;

export async function getTestKeys(): Promise<{
  privateKey: jose.KeyLike;
  publicKey: jose.KeyLike;
  jwks: { keys: jose.JWK[] };
  localKeyStore: jose.JWTVerifyGetKey;
}> {
  if (cachedPrivateKey && cachedPublicKey && cachedJwks && cachedLocalKeyStore) {
    return {
      privateKey: cachedPrivateKey,
      publicKey: cachedPublicKey,
      jwks: cachedJwks,
      localKeyStore: cachedLocalKeyStore
    };
  }

  const { publicKey, privateKey } = await jose.generateKeyPair('RS256', {
    extractable: true
  });

  const publicJwk = await jose.exportJWK(publicKey);
  publicJwk.kid = TEST_KID;
  publicJwk.alg = 'RS256';
  publicJwk.use = 'sig';

  cachedPrivateKey = privateKey;
  cachedPublicKey = publicKey;
  cachedJwks = { keys: [publicJwk] };
  cachedLocalKeyStore = jose.createLocalJWKSet(cachedJwks);

  return {
    privateKey: cachedPrivateKey,
    publicKey: cachedPublicKey,
    jwks: cachedJwks,
    localKeyStore: cachedLocalKeyStore
  };
}
