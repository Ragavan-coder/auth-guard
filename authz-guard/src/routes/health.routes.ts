import { Router, Request, Response } from 'express';
import Database from 'better-sqlite3';
import { getDatabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';

export function createHealthRouter(dbProvider: () => Database.Database = getDatabase): Router {
  const router = Router();

  // Liveness probe: returns 200 as long as the process is responsive
  router.get('/health/live', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString()
    });
  });

  // Readiness probe: verifies SQLite database connectivity
  router.get('/health/ready', (_req: Request, res: Response) => {
    try {
      const db = dbProvider();
      const row = db.prepare('SELECT 1 as alive').get() as { alive: number } | undefined;

      if (!row || row.alive !== 1) {
        throw new Error('Database ping query returned invalid result.');
      }

      res.status(200).json({
        status: 'ready',
        database: 'connected',
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      logger.error({ err }, 'Readiness check failed: SQLite database unreachable.');
      res.status(503).json({
        status: 'unready',
        database: 'unavailable',
        timestamp: new Date().toISOString()
      });
    }
  });

  return router;
}
