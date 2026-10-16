import { app } from './app.js';
import { getEnv } from './config/env.js';
import { runMigrations } from './database/migrate.js';
import { closeDatabase, getDatabase } from './database/connection.js';
import { logger } from './utils/logger.js';
import type { Server } from 'http';

let server: Server | null = null;

async function startServer(): Promise<void> {
  try {
    const env = getEnv();
    logger.info(
      {
        nodeEnv: env.NODE_ENV,
        port: env.PORT,
        issuer: env.OIDC_ISSUER_URL,
        audience: env.OIDC_AUDIENCE,
        databasePath: env.DATABASE_PATH
      },
      'Starting AuthZ Guard Authorization Service...'
    );

    // Apply database migrations before opening listening socket
    logger.info('Applying SQLite database migrations...');
    const db = getDatabase();
    runMigrations(db);
    logger.info('Database migrations ready.');

    // Start HTTP listening server
    server = app.listen(env.PORT, () => {
      logger.info(`AuthZ Guard listening on http://0.0.0.0:${env.PORT}`);
      logger.info(`OpenAPI documentation: http://localhost:${env.PORT}/docs`);
    });
  } catch (err) {
    logger.fatal({ err }, 'Failed to initialize AuthZ Guard server. Terminating process.');
    closeDatabase();
    process.exit(1);
  }
}

// Graceful shutdown handling
function gracefulShutdown(signal: string): void {
  logger.info({ signal }, 'Received termination signal. Shutting down gracefully...');

  if (server) {
    server.close((err) => {
      if (err) {
        logger.error({ err }, 'Error closing HTTP server.');
      } else {
        logger.info('HTTP server closed successfully.');
      }

      try {
        closeDatabase();
        logger.info('SQLite database connection closed.');
      } catch (dbErr) {
        logger.error({ dbErr }, 'Error closing SQLite database.');
      }

      process.exit(err ? 1 : 0);
    });

    // Enforce shutdown timeout if connections linger
    setTimeout(() => {
      logger.error('Graceful shutdown timeout exceeded. Forcing exit.');
      process.exit(1);
    }, 10000).unref();
  } else {
    closeDatabase();
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception encountered in application process.');
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled promise rejection encountered in application process.');
  gracefulShutdown('unhandledRejection');
});

// Run server
startServer();
