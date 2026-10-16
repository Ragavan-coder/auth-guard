import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { getEnv } from '../config/env.js';

let dbInstance: Database.Database | null = null;

export interface DatabaseOptions {
  path?: string;
  readonly?: boolean;
  verbose?: (message?: unknown, ...additionalArgs: unknown[]) => void;
}

export function createDatabaseConnection(options: DatabaseOptions = {}): Database.Database {
  const dbPath = options.path || getEnv().DATABASE_PATH;
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(dbPath, {
    readonly: options.readonly ?? false,
    verbose: options.verbose
  });

  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  if (dbPath !== ':memory:') {
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
  }

  return db;
}

export function getDatabase(): Database.Database {
  if (!dbInstance) {
    dbInstance = createDatabaseConnection();
  }
  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } finally {
      dbInstance = null;
    }
  }
}

export function setDatabaseInstance(customDb: Database.Database | null): void {
  if (dbInstance && dbInstance !== customDb) {
    try {
      dbInstance.close();
    } catch {
    }
  }
  dbInstance = customDb;
}
