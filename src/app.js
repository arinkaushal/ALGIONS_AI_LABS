import express from 'express';
import cors from 'cors';
import config from './config.js';
import requestIdMiddleware from './middleware/requestId.js';
import requestLoggerMiddleware from './middleware/requestLogger.js';
import errorHandlerMiddleware from './middleware/errorHandler.js';
import healthRoutes from './routes/health.js';
import metricsRoutes from './routes/metrics.js';
import showsRoutes from './routes/shows.js';
import bookingsRoutes from './routes/bookings.js';

export function createApp() {
  const app = express();

  // Trust proxy headers from reverse proxy (Nginx)
  app.set('trust proxy', 1);

  // Security & standard middleware
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request tracing and logging
  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware);

  // Health and Observability endpoints (root level)
  app.use(healthRoutes);
  app.use(metricsRoutes);

  // Business Domain API endpoints (versioned)
  app.use('/api/v1', showsRoutes);
  app.use('/api/v1', bookingsRoutes);

  // 404 Handler for undefined routes
  app.use((req, res) => {
    res.status(404).json({
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: `Route '${req.method} ${req.originalUrl}' not found.`,
        request_id: req.id,
        timestamp: new Date().toISOString()
      }
    });
  });

  // Global Error Handler
  app.use(errorHandlerMiddleware);

  return app;
}

export default createApp;

