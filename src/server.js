import http from 'http';
import createApp from './app.js';
import config from './config.js';
import logger from './logger.js';
import db from './db/index.js';
import migrate from './db/migrate.js';
import seed from './db/seed.js';
import bookingService from './services/bookingService.js';

let server = null;
let holdCleanupInterval = null;

async function startServer() {
  try {
    logger.info('Initializing Cinema Ticket Reservation Service...', {
      version: config.version,
      node_env: config.env,
      port: config.port
    });

    // Initialize database
    await db.init();

    // Auto-migrate and seed in development/local or when empty
    try {
      await migrate();
      await seed();
    } catch (err) {
      logger.warn('Migration or seed check warning', { message: err.message });
    }

    const app = createApp();
    server = http.createServer(app);

    server.listen(config.port, config.host, () => {
      logger.info(`Cinema Reservation API is listening on http://${config.host}:${config.port}`, {
        healthz: `http://${config.host}:${config.port}/healthz`,
        readyz: `http://${config.host}:${config.port}/readyz`,
        metrics: `http://${config.host}:${config.port}/metrics`,
        api_shows: `http://${config.host}:${config.port}/api/v1/shows`
      });
    });

    // Start background cleaner for expired seat holds
    holdCleanupInterval = setInterval(() => {
      bookingService.cleanExpiredHolds().catch((err) => {
        logger.error('Background hold cleanup failed', { error: err.message });
      });
    }, config.holdCleanupIntervalMs);

    // Graceful shutdown handling
    const shutdownSignals = ['SIGTERM', 'SIGINT'];
    shutdownSignals.forEach((signal) => {
      process.on(signal, () => handleShutdown(signal));
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Promise Rejection', { reason });
    });

    process.on('uncaughtException', (err) => {
      logger.error('Uncaught Exception', { error: err });
      process.exit(1);
    });

  } catch (err) {
    logger.error('Fatal failure starting application', { error: err });
    process.exit(1);
  }
}

async function handleShutdown(signal) {
  logger.info(`Received ${signal}, initiating graceful shutdown...`);

  if (holdCleanupInterval) {
    clearInterval(holdCleanupInterval);
    holdCleanupInterval = null;
  }

  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed, closing database connections...');
      await db.close();
      logger.info('Graceful shutdown completed successfully.');
      process.exit(0);
    });

    // Force exit after 10 seconds if hanging
    setTimeout(() => {
      logger.error('Graceful shutdown timed out, forcing exit.');
      process.exit(1);
    }, 10000).unref();
  } else {
    await db.close();
    process.exit(0);
  }
}

// Start if executed directly
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  startServer();
}

export { startServer, handleShutdown };
export default startServer;
