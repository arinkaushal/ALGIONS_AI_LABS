import logger from '../logger.js';
import { httpRequestsTotal, httpRequestDurationSeconds } from '../metrics.js';

export function requestLoggerMiddleware(req, res, next) {
  const start = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const durationSeconds = diff[0] + diff[1] / 1e9;
    const durationMs = Math.round(durationSeconds * 1000 * 100) / 100;

    const route = req.route ? req.route.path : req.path;
    const statusCode = res.statusCode.toString();

    // Record Prometheus metrics
    httpRequestsTotal.inc({
      method: req.method,
      route,
      status_code: statusCode
    });

    httpRequestDurationSeconds.observe({
      method: req.method,
      route,
      status_code: statusCode
    }, durationSeconds);

    // Filter out high-frequency healthchecks from verbose info logs unless error
    const isHealthCheck = req.path === '/healthz' || req.path === '/readyz' || req.path === '/metrics';
    if (!isHealthCheck || res.statusCode >= 400) {
      const logData = {
        requestId: req.id,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs,
        ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress
      };

      if (res.statusCode >= 500) {
        logger.error(`HTTP Request Failed ${req.method} ${req.originalUrl}`, logData);
      } else if (res.statusCode >= 400) {
        logger.warn(`HTTP Request Client Warning ${req.method} ${req.originalUrl}`, logData);
      } else {
        logger.info(`HTTP Request ${req.method} ${req.originalUrl}`, logData);
      }
    }
  });

  next();
}

export default requestLoggerMiddleware;

