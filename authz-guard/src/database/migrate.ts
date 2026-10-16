import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDatabase } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function runMigrations(db: Database.Database = getDatabase()): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const appliedStmt = db.prepare('SELECT version FROM schema_migrations WHERE version = ?');
  const recordMigrationStmt = db.prepare(
    "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, datetime('now'))"
  );

  const row = appliedStmt.get(1);
  if (!row) {
    let schemaSql: string;
    const directPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(directPath)) {
      schemaSql = fs.readFileSync(directPath, 'utf8');
    } else {
      const rootPath = path.join(__dirname, '../../src/database/schema.sql');
      if (fs.existsSync(rootPath)) {
        schemaSql = fs.readFileSync(rootPath, 'utf8');
      } else {
        throw new Error(`Could not find schema.sql at ${directPath} or ${rootPath}`);
      }
    }

    const applyTransaction = db.transaction(() => {
      db.exec(schemaSql);
      recordMigrationStmt.run(1, '001_initial_schema');
    });

    applyTransaction();
  }

  // Migration v2: users table for local authentication
  const rowV2 = appliedStmt.get(2);
  if (!rowV2) {
    const applyV2 = db.transaction(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      `);
      recordMigrationStmt.run(2, '002_users_table');
    });
    applyV2();
  }
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const db = getDatabase();
    runMigrations(db);
    console.log('[AuthZ Guard] Database migrations applied successfully.');
    process.exit(0);
  } catch (err) {
    console.error('[AuthZ Guard] FATAL: Database migration failed:', err);
    process.exit(1);
  }
}
