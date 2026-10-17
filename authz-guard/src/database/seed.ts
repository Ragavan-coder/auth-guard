import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';
import { getDatabase } from './connection.js';
import { runMigrations } from './migrate.js';
import { getEnv } from '../config/env.js';
import { SAMPLE_PERMISSIONS } from '../config/sample-permissions.js';

export function seedPermissions(db: Database.Database = getDatabase()): { insertedCount: number } {
  const env = getEnv();

  // Guard against seeding in production
  if (env.NODE_ENV === 'production') {
    throw new Error(
      '[AuthZ Guard] FORBIDDEN: Database seeding is not permitted in production environment.'
    );
  }

  // Ensure tables exist
  runMigrations(db);

  const insertStmt = db.prepare(`
    INSERT INTO user_permissions (user_id, action, resource, effect)
    VALUES (?, ?, ?, ?)
  `);

  let insertedCount = 0;

  const seedTransaction = db.transaction(() => {
    // Seed demo user accounts into users table if not present
    const userInsertStmt = db.prepare(`
      INSERT OR IGNORE INTO users (username, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `);

    userInsertStmt.run('user123', 'user123@authz-guard.internal', 'demo:password', 'user');
    userInsertStmt.run('user456', 'user456@authz-guard.internal', 'demo:password', 'user');
    userInsertStmt.run('user789', 'user789@authz-guard.internal', 'demo:password', 'user');
    userInsertStmt.run('admin789', 'admin789@authz-guard.internal', 'demo:password', 'admin');
    userInsertStmt.run('Ragavan S', 'cybersafety9870@gmail.com', 'demo:password', 'user');

    for (const perm of SAMPLE_PERMISSIONS) {
      // Check if exact rule already exists
      const existing = db
        .prepare(
          'SELECT id FROM user_permissions WHERE user_id = ? AND action = ? AND resource = ? AND effect = ?'
        )
        .get(perm.user_id, perm.action, perm.resource, perm.effect);

      if (!existing) {
        insertStmt.run(perm.user_id, perm.action, perm.resource, perm.effect);
        insertedCount++;
      }
    }
  });

  seedTransaction();
  return { insertedCount };
}

// Standalone execution support
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    const db = getDatabase();
    const result = seedPermissions(db);
    console.log(
      `[AuthZ Guard] Seeding complete. Inserted ${result.insertedCount} sample permission rows.`
    );
    process.exit(0);
  } catch (err) {
    console.error('[AuthZ Guard] FATAL: Database seeding failed:', err);
    process.exit(1);
  }
}
