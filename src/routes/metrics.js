import express from 'express';
import { register } from '../metrics.js';

const router = express.Router();

/**
 * Prometheus exposition endpoint
 */
router.get('/metrics', async (req, res) => {
  try {
    res.setHeader('Content-Type', register.contentType);
    const metricsData = await register.metrics();
    res.send(metricsData);
  } catch (err) {
    res.status(500).send(`Failed generating metrics: ${err.message}`);
  }
});

export default router;

