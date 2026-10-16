import Database from 'better-sqlite3';
import { getDatabase } from '../database/connection.js';
import { Action } from '../domain/authorization.types.js';
import { PolicyRule } from '../domain/policy.types.js';
import { DatabaseError } from '../domain/authorization.errors.js';
import { logger } from '../utils/logger.js';

interface RawPermissionRow {
  id: number;
  user_id: string;
  action: string;
  resource: string;
  effect: string;
}

export class PermissionRepository {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db || getDatabase();
  }

  /**
   * Retrieves all applicable permission rules for a given user and action using parameterized SQL.
   */
  public findByUserAndAction(userId: string, action: Action, secondaryId?: string): PolicyRule[] {
    try {
      let rows: RawPermissionRow[];
      if (secondaryId && secondaryId !== userId) {
        const stmt = this.db.prepare<[string, string, string]>(`
          SELECT id, user_id, action, resource, effect
          FROM user_permissions
          WHERE (user_id = ? OR user_id = ?) AND (action = ? OR action = '*')
        `);
        rows = stmt.all(userId, secondaryId, action) as RawPermissionRow[];
      } else {
        const stmt = this.db.prepare<[string, string]>(`
          SELECT id, user_id, action, resource, effect
          FROM user_permissions
          WHERE user_id = ? AND (action = ? OR action = '*')
        `);
        rows = stmt.all(userId, action) as RawPermissionRow[];
      }

      return rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        action: row.action as Action,
        resource: row.resource,
        effect: row.effect as 'allow' | 'deny'
      }));
    } catch (err) {
      logger.error({ err, userId, action }, 'Failed to query permissions from SQLite.');
      throw new DatabaseError('Failed to retrieve permissions from database.');
    }
  }
}
