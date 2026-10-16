import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../../src/database/migrate.js';
import { AuditRepository } from '../../src/repositories/audit.repository.js';
import { DatabaseError } from '../../src/domain/authorization.errors.js';

describe('Audit Repository Integration Tests', () => {
  let db: Database.Database;
  let repo: AuditRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
    repo = new AuditRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('persists structured authorization audit records without storing credentials', () => {
    const requestId = 'test-req-12345';
    repo.record({
      requestId,
      userId: 'user456',
      action: 'read',
      resource: 'wallets/wallet-789/transactions',
      decision: 'ALLOW',
      reasonCode: 'POLICY_ALLOW',
      matchedPolicyIds: [7]
    });

    const entries = repo.getByRequestId(requestId) as Array<{
      id: number;
      request_id: string;
      user_id: string;
      action: string;
      resource: string;
      decision: string;
      reason_code: string;
      matched_policy_ids: string;
      created_at: string;
    }>;

    expect(entries).toHaveLength(1);
    const entry = entries[0]!;
    expect(entry.request_id).toBe(requestId);
    expect(entry.user_id).toBe('user456');
    expect(entry.action).toBe('read');
    expect(entry.resource).toBe('wallets/wallet-789/transactions');
    expect(entry.decision).toBe('ALLOW');
    expect(entry.reason_code).toBe('POLICY_ALLOW');
    expect(JSON.parse(entry.matched_policy_ids)).toEqual([7]);
    expect(entry.created_at).toBeDefined();

    // Verify raw query confirms no sensitive fields exist in table
    const tableInfo = db.prepare("PRAGMA table_info('authorization_audit')").all() as Array<{
      name: string;
    }>;
    const colNames = tableInfo.map((c) => c.name);
    expect(colNames).not.toContain('access_token');
    expect(colNames).not.toContain('token');
    expect(colNames).not.toContain('authorization');
  });

  it('throws DatabaseError when audit persistence fails', () => {
    db.exec('DROP TABLE authorization_audit');

    expect(() =>
      repo.record({
        requestId: 'req-err',
        userId: 'u1',
        action: 'read',
        resource: 'transactions',
        decision: 'DENY',
        reasonCode: 'POLICY_DENY',
        matchedPolicyIds: []
      })
    ).toThrow(DatabaseError);
  });
});
