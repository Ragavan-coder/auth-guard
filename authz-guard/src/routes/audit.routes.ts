import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { getDatabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';

interface AuditRow {
  id: number;
  request_id: string;
  user_id: string | null;
  action: string;
  resource: string;
  decision: string;
  reason_code: string;
  matched_policy_ids: string;
  created_at: string;
}

export function createAuditRouter(dbProvider: () => Database.Database = getDatabase): Router {
  const router = Router();

  /**
   * GET /audit?limit=50&user_id=user123&decision=DENY
   * Returns recent authorization audit log entries. Query params:
   *   - limit:    max rows to return (default 50, max 200)
   *   - user_id:  filter to specific user
   *   - decision: filter to ALLOW or DENY
   */
  router.get('/audit', (req: Request, res: Response) => {
    try {
      const db = dbProvider();

      const rawLimit = parseInt(String(req.query['limit'] || '50'), 10);
      const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 50;

      const userId = typeof req.query['user_id'] === 'string' ? req.query['user_id'] : null;
      const decision =
        typeof req.query['decision'] === 'string'
          ? req.query['decision'].toUpperCase()
          : null;

      let sql = `
        SELECT id, request_id, user_id, action, resource, decision, reason_code,
               matched_policy_ids, created_at
        FROM authorization_audit
        WHERE 1=1
      `;
      const params: (string | number)[] = [];

      if (userId) {
        sql += ' AND user_id = ?';
        params.push(userId);
      }

      if (decision === 'ALLOW' || decision === 'DENY') {
        sql += ' AND decision = ?';
        params.push(decision);
      }

      sql += ' ORDER BY id DESC LIMIT ?';
      params.push(limit);

      const rows = db.prepare(sql).all(...params) as AuditRow[];

      const formatted = rows.map((row) => ({
        id: row.id,
        request_id: row.request_id,
        user_id: row.user_id,
        action: row.action,
        resource: row.resource,
        decision: row.decision,
        reason_code: row.reason_code,
        matched_policy_ids: JSON.parse(row.matched_policy_ids) as number[],
        created_at: row.created_at
      }));

      res.status(200).json({
        total: formatted.length,
        limit,
        entries: formatted
      });
    } catch (err) {
      logger.error({ err }, 'Failed to retrieve audit log entries.');
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve audit log.'
        }
      });
    }
  });

  return router;
}
