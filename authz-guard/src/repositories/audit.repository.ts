import Database from 'better-sqlite3';
import { getDatabase } from '../database/connection.js';
import { Decision } from '../domain/authorization.types.js';
import { DatabaseError } from '../domain/authorization.errors.js';
import { logger } from '../utils/logger.js';

export interface AuditRecord {
  requestId: string;
  userId: string | null;
  action: string;
  resource: string;
  decision: Decision;
  reasonCode: string;
  matchedPolicyIds: number[];
}

export class AuditRepository {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db || getDatabase();
  }

  /**
   * Persists an authorization audit event using a parameterized query.
   * Never stores access tokens, passwords, or raw headers.
   */
  public record(entry: AuditRecord): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO authorization_audit (
          request_id,
          user_id,
          action,
          resource,
          decision,
          reason_code,
          matched_policy_ids,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);

      stmt.run(
        entry.requestId,
        entry.userId,
        entry.action,
        entry.resource,
        entry.decision,
        entry.reasonCode,
        JSON.stringify(entry.matchedPolicyIds)
      );
    } catch (err) {
      logger.error({ err, requestId: entry.requestId }, 'Failed to persist audit event.');
      throw new DatabaseError('Failed to record authorization audit log.');
    }
  }

  /**
   * Helper to retrieve recent audit events (for test assertions and reporting).
   */
  public getByRequestId(requestId: string): unknown[] {
    const stmt = this.db.prepare('SELECT * FROM authorization_audit WHERE request_id = ?');
    return stmt.all(requestId);
  }
}
