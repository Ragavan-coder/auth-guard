import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../../src/app.js';
import { runMigrations } from '../../src/database/migrate.js';
import { seedPermissions } from '../../src/database/seed.js';
import { PermissionRepository } from '../../src/repositories/permission.repository.js';
import { AuditRepository } from '../../src/repositories/audit.repository.js';
import { TokenValidationService } from '../../src/services/token-validation.service.js';
import { getTestKeys, TEST_ISSUER, TEST_AUDIENCE } from '../fixtures/test-keys.js';
import { TestTokenFactory } from '../fixtures/test-token.factory.js';

describe('End-to-End Authorization Flow - All Sample Scenarios', () => {
  let db: Database.Database;
  let appInstance: ReturnType<typeof createApp>;
  let auditRepo: AuditRepository;

  beforeAll(async () => {
    db = new Database(':memory:');
    runMigrations(db);
    seedPermissions(db);

    const { localKeyStore } = await getTestKeys();
    const tokenValidator = new TokenValidationService({
      keyStore: localKeyStore,
      issuer: TEST_ISSUER,
      audience: TEST_AUDIENCE
    });

    const permissionRepo = new PermissionRepository(db);
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

  it('Scenario 1: user123 GET /transactions -> ALLOW', async () => {
    const token = await TestTokenFactory.createValidToken({ userId: 'user123' });
    const res = await request(appInstance)
      .post('/authorize')
      .send({ access_token: token, method: 'GET', path: '/transactions' });

    expect(res.status).toBe(200);
    expect(res.body.decision).toBe('ALLOW');
    expect(res.body.user_id).toBe('user123');
    expect(res.body.action).toBe('read');
    expect(res.body.resource).toBe('transactions');
    expect(res.body.reason_code).toBe('POLICY_ALLOW');
  });

  it('Scenario 2: user123 DELETE /transactions/txn-456 -> DENY (inherited explicit deny)', async () => {
    const token = await TestTokenFactory.createValidToken({ userId: 'user123' });
    const res = await request(appInstance)
      .post('/authorize')
      .send({ access_token: token, method: 'DELETE', path: '/transactions/txn-456' });

    expect(res.status).toBe(200);
    expect(res.body.decision).toBe('DENY');
    expect(res.body.user_id).toBe('user123');
    expect(res.body.action).toBe('delete');
    expect(res.body.resource).toBe('transactions/txn-456');
    expect(res.body.reason_code).toBe('INHERITED_DENY');
  });

  it('Scenario 3: user456 GET /wallets/wallet-789/transactions -> ALLOW', async () => {
    const token = await TestTokenFactory.createValidToken({ userId: 'user456' });
    const res = await request(appInstance).post('/authorize').send({
      access_token: token,
      method: 'GET',
      path: '/wallets/wallet-789/transactions'
    });

    expect(res.status).toBe(200);
    expect(res.body.decision).toBe('ALLOW');
    expect(res.body.user_id).toBe('user456');
    expect(res.body.action).toBe('read');
    expect(res.body.resource).toBe('wallets/wallet-789/transactions');
    expect(res.body.reason_code).toBe('POLICY_ALLOW');
  });

  it('Scenario 4: user789 POST /wallets/wallet-456/transactions/txn-999 -> ALLOW', async () => {
    const token = await TestTokenFactory.createValidToken({ userId: 'user789' });
    const res = await request(appInstance).post('/authorize').send({
      access_token: token,
      method: 'POST',
      path: '/wallets/wallet-456/transactions/txn-999'
    });

    expect(res.status).toBe(200);
    expect(res.body.decision).toBe('ALLOW');
    expect(res.body.user_id).toBe('user789');
    expect(res.body.action).toBe('write');
    expect(res.body.resource).toBe('wallets/wallet-456/transactions/txn-999');
    expect(res.body.reason_code).toBe('POLICY_ALLOW');
  });

  it('Scenario 5: user789 POST /wallets/wallet-789/transactions -> ALLOW', async () => {
    const token = await TestTokenFactory.createValidToken({ userId: 'user789' });
    const res = await request(appInstance).post('/authorize').send({
      access_token: token,
      method: 'POST',
      path: '/wallets/wallet-789/transactions'
    });

    expect(res.status).toBe(200);
    expect(res.body.decision).toBe('ALLOW');
    expect(res.body.user_id).toBe('user789');
    expect(res.body.action).toBe('write');
    expect(res.body.resource).toBe('wallets/wallet-789/transactions');
    expect(res.body.reason_code).toBe('POLICY_ALLOW');
  });

  it('Scenario 6: user456 POST /wallets/wallet-789/transactions -> DENY', async () => {
    const token = await TestTokenFactory.createValidToken({ userId: 'user456' });
    const res = await request(appInstance).post('/authorize').send({
      access_token: token,
      method: 'POST',
      path: '/wallets/wallet-789/transactions'
    });

    expect(res.status).toBe(200);
    expect(res.body.decision).toBe('DENY');
    expect(res.body.user_id).toBe('user456');
    expect(res.body.action).toBe('write');
    expect(res.body.reason_code).toBe('NO_MATCHING_POLICY');
  });

  it('Scenario 7: admin789 DELETE /accounts/acc-123/settings -> ALLOW', async () => {
    const token = await TestTokenFactory.createValidToken({ userId: 'admin789' });
    const res = await request(appInstance).post('/authorize').send({
      access_token: token,
      method: 'DELETE',
      path: '/accounts/acc-123/settings'
    });

    expect(res.status).toBe(200);
    expect(res.body.decision).toBe('ALLOW');
    expect(res.body.user_id).toBe('admin789');
    expect(res.body.action).toBe('delete');
    expect(res.body.reason_code).toBe('POLICY_ALLOW');
  });

  it('Scenario 8: user456 GET /wallets/wallet-999 -> ALLOW (terminal wildcard)', async () => {
    const token = await TestTokenFactory.createValidToken({ userId: 'user456' });
    const res = await request(appInstance).post('/authorize').send({
      access_token: token,
      method: 'GET',
      path: '/wallets/wallet-999'
    });

    expect(res.status).toBe(200);
    expect(res.body.decision).toBe('ALLOW');
    expect(res.body.user_id).toBe('user456');
    expect(res.body.action).toBe('read');
    expect(res.body.resource).toBe('wallets/wallet-999');
    expect(res.body.reason_code).toBe('POLICY_ALLOW');
  });

  it('Scenario 9: user123 GET /wallets/wallet-789 -> DENY (no matching policy)', async () => {
    const token = await TestTokenFactory.createValidToken({ userId: 'user123' });
    const res = await request(appInstance).post('/authorize').send({
      access_token: token,
      method: 'GET',
      path: '/wallets/wallet-789'
    });

    expect(res.status).toBe(200);
    expect(res.body.decision).toBe('DENY');
    expect(res.body.user_id).toBe('user123');
    expect(res.body.action).toBe('read');
    expect(res.body.reason_code).toBe('NO_MATCHING_POLICY');
  });

  it('verifies that audit records were persisted in SQLite for all scenarios', () => {
    const totalAuditCount = db
      .prepare('SELECT COUNT(*) as count FROM authorization_audit')
      .get() as { count: number };

    // At least 9 audit records corresponding to the 9 scenarios
    expect(totalAuditCount.count).toBeGreaterThanOrEqual(9);
  });
});
