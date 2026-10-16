import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../../src/database/migrate.js';
import { PermissionRepository } from '../../src/repositories/permission.repository.js';
import { DatabaseError } from '../../src/domain/authorization.errors.js';

describe('Permission Repository Integration Tests', () => {
  let db: Database.Database;
  let repo: PermissionRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
    repo = new PermissionRepository(db);

    // Seed test rows
    const insert = db.prepare(
      'INSERT INTO user_permissions (user_id, action, resource, effect) VALUES (?, ?, ?, ?)'
    );
    insert.run('user123', 'read', 'transactions', 'allow');
    insert.run('user123', 'write', 'transactions', 'allow');
    insert.run('user123', 'delete', 'transactions', 'deny');
    insert.run('user456', 'read', 'wallets/*', 'allow');
  });

  afterEach(() => {
    db.close();
  });

  it('retrieves permissions matching user and action using parameterized queries', () => {
    const rules = repo.findByUserAndAction('user123', 'read');
    expect(rules).toHaveLength(1);
    expect(rules[0]?.resource).toBe('transactions');
    expect(rules[0]?.effect).toBe('allow');
  });

  it('retrieves explicit delete denial for user123', () => {
    const rules = repo.findByUserAndAction('user123', 'delete');
    expect(rules).toHaveLength(1);
    expect(rules[0]?.effect).toBe('deny');
  });

  it('returns empty array when user has no permissions for the action', () => {
    const rules = repo.findByUserAndAction('user456', 'delete');
    expect(rules).toHaveLength(0);
  });

  it('throws DatabaseError when underlying database query fails', () => {
    // Drop table to simulate operational database failure
    db.exec('DROP TABLE user_permissions');
    expect(() => repo.findByUserAndAction('user123', 'read')).toThrow(DatabaseError);
  });
});
