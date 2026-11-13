import express from 'express';
import db from '../db/index.js';
import config from '../config.js';

const router = express.Router();
const startTime = Date.now();

/**
 * Liveness Probe: Verifies process is alive and responsive
 */
router.get('/healthz', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    service: config.serviceName,
    version: config.version
  });
});

/**
 * Readiness Probe: Verifies database connectivity and query readiness
 */
router.get('/readyz', async (req, res) => {
  const isHealthy = await db.ping();
  const timestamp = new Date().toISOString();

  if (isHealthy) {
    return res.status(200).json({
      status: 'ready',
      database: 'connected',
      engine: db.isPostgres() ? 'postgresql' : 'sqlite',
      timestamp
    });
  } else {
    return res.status(503).json({
      status: 'not_ready',
      database: 'disconnected',
      timestamp
    });
  }
});

export default router;
