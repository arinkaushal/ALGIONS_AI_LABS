import express from 'express';
import db from '../db/index.js';
import config from '../config.js';

const router = express.Router();
const startTime = Date.now();

/**
 * Root Welcome & Interactive API Dashboard
 */
router.get('/', (req, res) => {
  const acceptsHtml = req.accepts(['json', 'html']) === 'html';
  const apiData = {
    service: config.serviceName,
    version: config.version,
    status: 'OPERATIONAL',
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    endpoints: {
      liveness: '/healthz',
      readiness: '/readyz',
      metrics: '/metrics',
      shows: '/api/v1/shows',
      seat_map_sample: '/api/v1/shows/show-interstellar-imax/seats',
      bookings: '/api/v1/bookings'
    },
    documentation: 'https://github.com/arinkaushal/ALGIONS_AI_LABS'
  };

  if (!acceptsHtml) {
    return res.status(200).json(apiData);
  }

  // HTML Dashboard for browser visits
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cinema Ticket Reservation Service</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: Calibri, 'Segoe UI', Candara, sans-serif !important;
      font-weight: normal !important;
    }
    body {
      background-color: #ffffff;
      color: #000000;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 3rem 1.5rem;
    }
    .container {
      max-width: 900px;
      width: 100%;
    }
    .header {
      text-align: center;
      margin-bottom: 2rem;
    }
    h1 {
      font-size: 2.2rem;
      color: #000000;
      margin-bottom: 0.5rem;
      letter-spacing: -0.01em;
    }
    p.subtitle {
      color: #000000;
      font-size: 1.05rem;
      max-width: 650px;
      margin: 0 auto;
      line-height: 1.5;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1.25rem;
      margin-top: 2rem;
      margin-bottom: 2.5rem;
    }
    .card {
      background-color: #ffffff;
      border: 1px solid #000000;
      color: #000000;
      padding: 1.5rem;
      text-decoration: none;
      display: flex;
      flex-direction: column;
      transition: background-color 0.15s ease, color 0.15s ease;
    }
    .card:hover {
      background-color: #000000;
      color: #ffffff;
    }
    .card:hover .card-title,
    .card:hover .card-desc,
    .card:hover .card-path {
      color: #ffffff;
    }
    .card:hover svg {
      stroke: #ffffff;
    }
    .card:hover .card-path {
      border-color: #ffffff;
    }
    .card-title {
      font-size: 1.15rem;
      color: #000000;
      margin-bottom: 0.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .card-title svg {
      flex-shrink: 0;
      stroke: #000000;
    }
    .card-path {
      font-size: 0.85rem;
      color: #000000;
      border: 1px solid #000000;
      padding: 0.15rem 0.5rem;
      margin-bottom: 0.75rem;
      display: inline-block;
      align-self: flex-start;
    }
    .card-desc {
      color: #000000;
      font-size: 0.95rem;
      line-height: 1.4;
    }
    .footer {
      text-align: center;
      padding-top: 1.5rem;
      border-top: 1px solid #000000;
      color: #000000;
      font-size: 0.9rem;
    }
    .footer a {
      color: #000000;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Cinema Ticket Reservation Service</h1>
      <p class="subtitle">High-concurrency microservice with automated seat holds, atomic locking, Prometheus metrics, and cloud CI/CD.</p>
    </div>

    <div class="grid">
      <a href="/api/v1/shows" class="card" target="_blank">
        <div class="card-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>
          Movie Shows
        </div>
        <div class="card-path">GET /api/v1/shows</div>
        <div class="card-desc">Lists all active cinema showtimes with screen specs, audio formats, and base pricing.</div>
      </a>

      <a href="/api/v1/shows/show-interstellar-imax/seats" class="card" target="_blank">
        <div class="card-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 13v-3a5 5 0 0 1 10 0v3"/><path d="M5 13h14v6H5z"/><path d="M5 19v2"/><path d="M19 19v2"/><path d="M2 13v3"/><path d="M22 13v3"/></svg>
          Seat Matrix
        </div>
        <div class="card-path">GET /api/v1/shows/:id/seats</div>
        <div class="card-desc">Real-time seat layout showing AVAILABLE, HELD, and BOOKED statuses with tier multipliers.</div>
      </a>

      <a href="/healthz" class="card" target="_blank">
        <div class="card-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          Liveness Probe
        </div>
        <div class="card-path">GET /healthz</div>
        <div class="card-desc">Kubernetes/Docker liveness probe returning uptime, service version, and process health.</div>
      </a>

      <a href="/readyz" class="card" target="_blank">
        <div class="card-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
          Readiness Probe
        </div>
        <div class="card-path">GET /readyz</div>
        <div class="card-desc">Verifies live database connectivity (PostgreSQL / SQLite) before accepting user traffic.</div>
      </a>

      <a href="/metrics" class="card" target="_blank">
        <div class="card-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>
          Prometheus Metrics
        </div>
        <div class="card-path">GET /metrics</div>
        <div class="card-desc">Observability metrics: HTTP latency histograms, booking counters, seat hold gauges.</div>
      </a>

      <a href="https://github.com/arinkaushal/ALGIONS_AI_LABS" class="card" target="_blank">
        <div class="card-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
          Source Repository
        </div>
        <div class="card-path">GitHub</div>
        <div class="card-desc">CI/CD pipelines, Docker containerization, Runbooks, and verification test suites.</div>
      </a>
    </div>

    <div class="footer">
      Cinema Reservation Microservice v${config.version} | Deployed for ALGIONS AI LABS Assessment
    </div>
  </div>
</body>
</html>`;

  res.status(200).send(html);
});

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

