import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 10000,
    hookTimeout: 10000,
    env: {
      NODE_ENV: 'test',
      OIDC_ISSUER_URL: 'https://test-issuer.authz-guard.internal',
      OIDC_AUDIENCE: 'https://test-api.authz-guard.internal',
      DATABASE_PATH: ':memory:',
      LOG_LEVEL: 'fatal'
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts', 'src/database/seed.ts']
    }
  }
});
