import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { createApp } from '../../src/app.js';
import { runMigrations } from '../../src/database/migrate.js';
import { PermissionRepository } from '../../src/repositories/permission.repository.js';
import { AuditRepository } from '../../src/repositories/audit.repository.js';
import { TokenValidationService } from '../../src/services/token-validation.service.js';
import { getTestKeys, TEST_ISSUER, TEST_AUDIENCE } from '../fixtures/test-keys.js';
import { TestTokenFactory } from '../fixtures/test-token.factory.js';

describe('HTTP Authorization Routes Integration Tests', () => {
  let db: Database.Database;
  let appInstance: ReturnType<typeof createApp>;

  beforeEach(async () => {
    db = new Database(':memory:');
    runMigrations(db);

    // Seed sample rules
    const insert = db.prepare(
      'INSERT INTO user_permissions (user_id, action, resource, effect) VALUES (?, ?, ?, ?)'
    );
    insert.run('user123', 'read', 'transactions', 'allow');
    insert.run('user123', 'write', 'transactions', 'allow');
    insert.run('user123', 'delete', 'transactions', 'deny');
    insert.run('user456', 'read', 'wallets/*', 'allow');

    const { localKeyStore } = await getTestKeys();
    const tokenValidator = new TokenValidationService({
      keyStore: localKeyStore,
      issuer: TEST_ISSUER,
      audience: TEST_AUDIENCE
    });

    const permissionRepo = new PermissionRepository(db);
    const auditRepo = new AuditRepository(db);

    appInstance = createApp({
      tokenValidator,
      permissionRepo,
      auditRepo,
      disableRateLimit: true
    });
  });

  afterEach(() => {
    db.close();
  });

  it('POST /authorize evaluates ALLOW decision and returns HTTP 200 with correlation ID', async () => {
    const token = await TestTokenFactory.createValidToken({ userId: 'user123' });

    const res = await request(appInstance)
      .post('/authorize')
      .set('x-request-id', 'test-client-correlation-id-1')
      .send({
        access_token: token,
        method: 'GET',
        path: '/transactions'
      });

    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBe('test-client-correlation-id-1');
    expect(res.body).toMatchObject({
      decision: 'ALLOW',
      user_id: 'user123',
      action: 'read',
      resource: 'transactions',
      reason_code: 'POLICY_ALLOW',
      request_id: 'test-client-correlation-id-1'
    });
    expect(res.body.matched_permissions).toHaveLength(1);
  });

  it('POST /authorize evaluates DENY decision and returns HTTP 200 per API specification', async () => {
    const token = await TestTokenFactory.createValidToken({ userId: 'user123' });

    const res = await request(appInstance).post('/authorize').send({
      access_token: token,
      method: 'DELETE',
      path: '/transactions/txn-456'
    });

    expect(res.status).toBe(200);
    expect(res.body.decision).toBe('DENY');
    expect(res.body.user_id).toBe('user123');
    expect(res.body.action).toBe('delete');
    expect(res.body.resource).toBe('transactions/txn-456');
    expect(res.body.reason_code).toBe('INHERITED_DENY');
    expect(res.body.request_id).toBeDefined();
  });

  it('POST /authorize returns 401 INVALID_TOKEN for expired or untrusted token', async () => {
    const expiredToken = await TestTokenFactory.createExpiredToken('user123');

    const res = await request(appInstance).post('/authorize').send({
      access_token: expiredToken,
      method: 'GET',
      path: '/transactions'
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('INVALID_TOKEN');
    expect(res.body.error.request_id).toBeDefined();
    // Cryptographic details must not be exposed
    expect(res.body.error.message).toBe(
      'The provided access token is invalid, expired, or untrusted.'
    );
  });

  it('POST /authorize returns 400 INVALID_REQUEST on malformed request body or missing fields', async () => {
    const res = await request(appInstance).post('/authorize').send({
      // missing access_token
      method: 'GET',
      path: '/transactions'
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
  });

  it('POST /authorize returns 400 INVALID_REQUEST when path traversal is attempted', async () => {
    const token = await TestTokenFactory.createValidToken({ userId: 'user123' });

    const res = await request(appInstance).post('/authorize').send({
      access_token: token,
      method: 'GET',
      path: '/transactions/../admin'
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_REQUEST');
  });

  it('POST /authorize returns 405 METHOD_NOT_ALLOWED on unsupported method', async () => {
    const token = await TestTokenFactory.createValidToken({ userId: 'user123' });

    const res = await request(appInstance).post('/authorize').send({
      access_token: token,
      method: 'TRACE',
      path: '/transactions'
    });

    expect(res.status).toBe(405);
    expect(res.body.error.code).toBe('METHOD_NOT_ALLOWED');
  });

  it('GET /health/live returns 200 alive', async () => {
    const res = await request(appInstance).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('alive');
  });

  it('GET /health/ready returns 200 ready when SQLite is operational', async () => {
    const res = await request(appInstance).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.database).toBe('connected');
  });
});
