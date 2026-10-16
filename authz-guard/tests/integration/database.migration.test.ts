import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../../src/database/migrate.js';

describe('Database Migration Integration Tests', () => {
  it('applies schema migrations idempotently and creates required tables and indexes', () => {
    const db = new Database(':memory:');

    // Run migration
    runMigrations(db);

    // Verify schema_migrations table
    const migration = db
      .prepare('SELECT version, name FROM schema_migrations WHERE version = 1')
      .get() as { version: number; name: string };
    expect(migration).toBeDefined();
    expect(migration.version).toBe(1);
    expect(migration.name).toBe('001_initial_schema');

    // Verify user_permissions table exists
    const permTable = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user_permissions'")
      .get();
    expect(permTable).toBeDefined();

    // Verify authorization_audit table exists
    const auditTable = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='authorization_audit'")
      .get();
    expect(auditTable).toBeDefined();

    // Verify indexes exist
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='user_permissions'")
      .all() as { name: string }[];
    const indexNames = indexes.map((i) => i.name);
    expect(indexNames).toContain('idx_user_permissions_user_action');
    expect(indexNames).toContain('idx_user_permissions_lookup');

    // Re-running migrations should be idempotent
    expect(() => runMigrations(db)).not.toThrow();

    db.close();
  });

  it('enforces table CHECK constraints on action and effect', () => {
    const db = new Database(':memory:');
    runMigrations(db);

    // Valid insert
    const insertStmt = db.prepare(
      'INSERT INTO user_permissions (user_id, action, resource, effect) VALUES (?, ?, ?, ?)'
    );
    expect(() => insertStmt.run('u1', 'read', 'transactions', 'allow')).not.toThrow();

    // Invalid action fails CHECK constraint
    expect(() => insertStmt.run('u1', 'fly', 'transactions', 'allow')).toThrow();

    // Invalid effect fails CHECK constraint
    expect(() => insertStmt.run('u1', 'read', 'transactions', 'maybe')).toThrow();

    db.close();
  });
});
