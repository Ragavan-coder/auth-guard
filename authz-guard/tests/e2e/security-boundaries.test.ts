import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../../src/app.js';
import { runMigrations } from '../../src/database/migrate.js';
import { PermissionRepository } from '../../src/repositories/permission.repository.js';
import { AuditRepository } from '../../src/repositories/audit.repository.js';
import { TokenValidationService } from '../../src/services/token-validation.service.js';
import { getTestKeys, TEST_ISSUER, TEST_AUDIENCE } from '../fixtures/test-keys.js';
import { TestTokenFactory } from '../fixtures/test-token.factory.js';

describe('Security Boundaries & Adversarial E2E Tests', () => {
  let db: Database.Database;
  let appInstance: ReturnType<typeof createApp>;
  let permissionRepo: PermissionRepository;
  let auditRepo: AuditRepository;
  let tokenValidator: TokenValidationService;

  beforeAll(async () => {
    db = new Database(':memory:');
    runMigrations(db);

    const { localKeyStore } = await getTestKeys();
    tokenValidator = new TokenValidationService({
      keyStore: localKeyStore,
      issuer: TEST_ISSUER,
      audience: TEST_AUDIENCE
    });

    permissionRepo = new PermissionRepository(db);
    auditRepo = new AuditRepository(db);

    appInstance = createApp({
      tokenValidator,
      permissionRepo,
      auditRepo,
      disableRateLimit: true
    });
  });

  afterAll(() => {
    db.close();
  });

  it('rejects attempt to spoof identity via body (user_id is only derived from verified JWT)', async () => {
    // Attacker sends token for user123, but puts user_id: 'admin789' in body
    const token = await TestTokenFactory.createValidToken({ userId: 'user123' });

    const res = await request(appInstance).post('/authorize').send({
      access_token: token,
      method: 'GET',
      path: '/transactions',
      user_id: 'admin789' // malicious attempt
    });

    expect(res.status).toBe(200);
    // Verified user_id MUST be user123 (from cryptographically verified token), NOT admin789
    expect(res.body.user_id).toBe('user123');
  });

  it('rejects path traversal attempts and prevents privilege escalation', async () => {
    const token = await TestTokenFactory.createValidToken({ userId: 'user123' });

    const traversalAttacks = [
      '/transactions/../accounts',
      '/transactions/..',
      '/transactions/%2e%2e/admin',
      '/transactions/%2e/admin',
      '/transactions/..%2fadmin',
      '/transactions\\admin',
      '/transactions//admin'
    ];

    for (const evilPath of traversalAttacks) {
      const res = await request(appInstance).post('/authorize').send({
        access_token: token,
        method: 'GET',
        path: evilPath
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_REQUEST');
    }
  });

  it('rejects tokens with forged/corrupted signatures', async () => {
    const validToken = await TestTokenFactory.createValidToken({ userId: 'user123' });
    // Corrupt signature portion
    const parts = validToken.split('.');
    const corruptedToken = `${parts[0]}.${parts[1]}.corruptedSignature`;

    const res = await request(appInstance).post('/authorize').send({
      access_token: corruptedToken,
      method: 'GET',
      path: '/transactions'
    });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('rejects tokens signed by an untrusted rogue key pair', async () => {
    const rogueToken = await TestTokenFactory.createUntrustedSignatureToken('user123');

    const res = await request(appInstance).post('/authorize').send({
      access_token: rogueToken,
      method: 'GET',
      path: '/transactions'
    });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('fails closed when SQLite database encounters internal failure (never returns ALLOW)', async () => {
    const token = await TestTokenFactory.createValidToken({ userId: 'admin789' });

    // Mock a broken permission repository that throws an unexpected error
    const brokenPermissionRepo = {
      findByUserAndAction: () => {
        throw new Error('SQLite disk I/O failure');
      }
    } as unknown as PermissionRepository;

    const brokenApp = createApp({
      tokenValidator,
      permissionRepo: brokenPermissionRepo,
      auditRepo,
      disableRateLimit: true
    });

    const res = await request(brokenApp).post('/authorize').send({
      access_token: token,
      method: 'GET',
      path: '/transactions'
    });

    // Must NEVER return ALLOW or HTTP 200 on internal failure
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect(res.body.decision).toBeUndefined();
  });

  it('enforces Helmet security headers on all responses', async () => {
    const res = await request(appInstance).get('/health/live');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['strict-transport-security']).toBeDefined();
  });

  it('rejects oversized request bodies exceeding payload limit', async () => {
    const token = await TestTokenFactory.createValidToken({ userId: 'user123' });
    const hugePayload = 'X'.repeat(32 * 1024); // 32KB exceeds 16KB default

    const res = await request(appInstance).post('/authorize').send({
      access_token: token,
      method: 'GET',
      path: '/transactions',
      extra: hugePayload
    });

    // Express json parser rejects oversized payload with 413 or 400
    expect([400, 413]).toContain(res.status);
  });
});
