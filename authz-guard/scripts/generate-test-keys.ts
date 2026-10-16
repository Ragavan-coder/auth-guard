import * as jose from 'jose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function generateTestKeys(): Promise<{
  publicKeyJwk: jose.JWK;
  privateKeyJwk: jose.JWK;
  jwks: { keys: jose.JWK[] };
}> {
  const { publicKey, privateKey } = await jose.generateKeyPair('RS256', {
    extractable: true
  });

  const kid = 'test-key-1';
  const publicJwk = await jose.exportJWK(publicKey);
  const privateJwk = await jose.exportJWK(privateKey);

  publicJwk.kid = kid;
  publicJwk.alg = 'RS256';
  publicJwk.use = 'sig';

  privateJwk.kid = kid;
  privateJwk.alg = 'RS256';
  privateJwk.use = 'sig';

  return {
    publicKeyJwk: publicJwk,
    privateKeyJwk: privateJwk,
    jwks: {
      keys: [publicJwk]
    }
  };
}

// CLI runner: outputs to data/test-keys directory if executed directly
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  (async () => {
    try {
      const keys = await generateTestKeys();
      const targetDir = path.resolve(__dirname, '../data/test-keys');
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      fs.writeFileSync(
        path.join(targetDir, 'jwks.json'),
        JSON.stringify(keys.jwks, null, 2),
        'utf8'
      );
      fs.writeFileSync(
        path.join(targetDir, 'private.key.json'),
        JSON.stringify(keys.privateKeyJwk, null, 2),
        'utf8'
      );

      console.log(`[AuthZ Guard] Generated local test signing keys at: ${targetDir}`);
      console.log('  - jwks.json (Public JWKS key set)');
      console.log('  - private.key.json (Local-only private test key - NOT committed)');
    } catch (err) {
      console.error('[AuthZ Guard] Failed to generate test keys:', err);
      process.exit(1);
    }
  })();
}
