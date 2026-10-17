import Database from 'better-sqlite3';
import { getDatabase } from '../database/connection.js';
import { DatabaseError } from '../domain/authorization.errors.js';
import { logger } from '../utils/logger.js';

export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  role: 'user' | 'admin';
  created_at: string;
  updated_at: string;
}

export interface UserPublic {
  id: number;
  username: string;
  email: string;
  role: 'user' | 'admin';
  created_at: string;
}

export interface UserWithPermissions extends UserPublic {
  permissions: Array<{ id: number; action: string; resource: string; effect: string }>;
}

export class UserRepository {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db || getDatabase();
  }

  public create(data: {
    username: string;
    email: string;
    password_hash: string;
    role?: 'user' | 'admin';
  }): User {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO users (username, email, password_hash, role)
        VALUES (?, ?, ?, ?)
      `);
      const result = stmt.run(
        data.username,
        data.email,
        data.password_hash,
        data.role || 'user'
      );
      return this.findById(result.lastInsertRowid as number)!;
    } catch (err) {
      logger.error({ err }, 'Failed to create user in database.');
      throw new DatabaseError('Failed to create user.');
    }
  }

  public findByEmail(email: string): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
    return (stmt.get(email) as User) || null;
  }

  public findByUsername(username: string): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
    return (stmt.get(username) as User) || null;
  }

  public findById(id: number): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    return (stmt.get(id) as User) || null;
  }

  public upsertOAuthUser(data: { sub: string; email: string; name?: string }): User {
    const existing = this.findByEmail(data.email) || (data.sub ? this.findByUsername(data.sub) : null);
    if (existing) {
      return existing;
    }
    const username = data.name || data.sub || data.email.split('@')[0];
    return this.create({
      username,
      email: data.email,
      password_hash: 'oauth2:auth0',
      role: 'user'
    });
  }

  public findAll(): UserPublic[] {
    const stmt = this.db.prepare(
      'SELECT id, username, email, role, created_at FROM users ORDER BY id ASC'
    );
    return stmt.all() as UserPublic[];
  }

  public findAllWithPermissions(): UserWithPermissions[] {
    const users = this.findAll();
    const existingUserIds = new Set<string>();
    for (const u of users) {
      existingUserIds.add(u.email);
      existingUserIds.add(u.username);
    }

    // Automatically discover any identities in user_permissions (e.g. user123, user456, user789)
    const distinctPermUsers = this.db
      .prepare('SELECT DISTINCT user_id FROM user_permissions ORDER BY user_id ASC')
      .all() as Array<{ user_id: string }>;

    let virtualId = 1000;
    const additionalUsers: UserWithPermissions[] = [];

    for (const { user_id } of distinctPermUsers) {
      if (!existingUserIds.has(user_id)) {
        const perms = this.db
          .prepare(
            'SELECT id, user_id, action, resource, effect FROM user_permissions WHERE user_id = ? ORDER BY id ASC'
          )
          .all(user_id) as Array<{ id: number; action: string; resource: string; effect: string }>;

        additionalUsers.push({
          id: virtualId++,
          username: user_id,
          email: user_id.includes('@') ? user_id : `${user_id}@authz-guard.internal`,
          role: user_id.toLowerCase().includes('admin') ? 'admin' : 'user',
          created_at: '2026-10-17 00:00:00',
          permissions: perms
        });
      }
    }

    const mappedUsers = users.map((u) => {
      const perms = this.db
        .prepare(
          'SELECT id, user_id, action, resource, effect FROM user_permissions WHERE user_id = ? OR user_id = ? ORDER BY id ASC'
        )
        .all(u.email, u.username) as Array<{ id: number; action: string; resource: string; effect: string }>;
      return { ...u, permissions: perms };
    });

    return [...mappedUsers, ...additionalUsers];
  }

  public deleteById(id: number): boolean {
    try {
      const user = this.findById(id);
      if (!user) return false;
      this.db.prepare('DELETE FROM user_permissions WHERE user_id = ? OR user_id = ?').run(user.email, user.username);
      const stmt = this.db.prepare('DELETE FROM users WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (err) {
      logger.error({ err, id }, 'Failed to delete user.');
      throw new DatabaseError('Failed to delete user.');
    }
  }

  public updateRole(id: number, role: 'user' | 'admin'): boolean {
    const stmt = this.db.prepare(
      "UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?"
    );
    const result = stmt.run(role, id);
    return result.changes > 0;
  }

  public ensureAdmin(email: string, passwordHash: string): void {
    const existing = this.findByEmail(email);
    if (!existing) {
      this.create({ username: 'admin', email, password_hash: passwordHash, role: 'admin' });
      logger.info('Default admin user seeded.');
    }
  }
}
