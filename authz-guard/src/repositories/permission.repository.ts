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
   * Retrieves all applicable permission rules for a given user (or user aliases) and action using parameterized SQL.
   */
  public findByUserAndAction(
    userIds: string | string[],
    action: Action,
    secondaryId?: string
  ): PolicyRule[] {
    try {
      const idSet = new Set<string>();
      if (Array.isArray(userIds)) {
        for (const id of userIds) {
          if (typeof id === 'string' && id.trim()) idSet.add(id.trim());
        }
      } else if (typeof userIds === 'string' && userIds.trim()) {
        idSet.add(userIds.trim());
      }
      if (secondaryId && typeof secondaryId === 'string' && secondaryId.trim()) {
        idSet.add(secondaryId.trim());
      }

      if (idSet.size === 0) {
        return [];
      }

      const idList = Array.from(idSet);
      const placeholders = idList.map(() => '?').join(', ');
      const sql = `
        SELECT id, user_id, action, resource, effect
        FROM user_permissions
        WHERE user_id IN (${placeholders}) AND (action = ? OR action = '*')
      `;

      const rows = this.db.prepare(sql).all(...idList, action) as RawPermissionRow[];

      return rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        action: row.action as Action,
        resource: row.resource,
        effect: row.effect as 'allow' | 'deny'
      }));
    } catch (err) {
      logger.error({ err, userIds, action }, 'Failed to query permissions from SQLite.');
      throw new DatabaseError('Failed to retrieve permissions from database.');
    }
  }
}
