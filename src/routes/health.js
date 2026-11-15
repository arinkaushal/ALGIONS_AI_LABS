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
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #38bdf8;
      --success: #22c55e;
      --accent: #818cf8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2.5rem 1rem;
    }
    .container {
      max-width: 900px;
      width: 100%;
    }
    .header {
      text-align: center;
      margin-bottom: 2.5rem;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(34, 197, 94, 0.15);
      color: var(--success);
      border: 1px solid rgba(34, 197, 94, 0.3);
      padding: 0.35rem 0.85rem;
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 1rem;
    }
    .badge::before {
      content: "";
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--success);
      box-shadow: 0 0 10px var(--success);
    }
    h1 {
      font-size: 2.25rem;
      font-weight: 800;
      letter-spacing: -0.025em;
      margin-bottom: 0.75rem;
      background: linear-gradient(to right, #38bdf8, #818cf8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    p.subtitle {
      color: var(--text-muted);
      font-size: 1.1rem;
      max-width: 650px;
      margin: 0 auto;
      line-height: 1.6;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 1.25rem;
      margin-bottom: 2.5rem;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      transition: transform 0.2s, border-color 0.2s;
      text-decoration: none;
      color: inherit;
      display: flex;
      flex-direction: column;
    }
    .card:hover {
      transform: translateY(-3px);
      border-color: var(--primary);
    }
    .card-title {
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--primary);
      margin-bottom: 0.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .card-path {
      font-family: monospace;
      font-size: 0.85rem;
      background: rgba(0,0,0,0.3);
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      color: #cbd5e1;
      margin-bottom: 0.75rem;
      display: inline-block;
      align-self: flex-start;
    }
    .card-desc {
      color: var(--text-muted);
      font-size: 0.9rem;
      line-height: 1.5;
    }
    .footer {
      text-align: center;
      padding-top: 1.5rem;
      border-top: 1px solid var(--border);
      color: var(--text-muted);
      font-size: 0.875rem;
    }
    .footer a {
      color: var(--primary);
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">SYSTEM ONLINE & READY</div>
      <h1>Cinema Ticket Reservation Service</h1>
      <p class="subtitle">High-concurrency microservice with automated seat holds, atomic locking, Prometheus metrics, and cloud CI/CD.</p>
    </div>

    <div class="grid">
      <a href="/api/v1/shows" class="card" target="_blank">
        <div class="card-title">🎬 Movie Shows</div>
        <div class="card-path">GET /api/v1/shows</div>
        <div class="card-desc">Lists all active cinema showtimes with screen specs, audio formats, and base pricing.</div>
      </a>

      <a href="/api/v1/shows/show-interstellar-imax/seats" class="card" target="_blank">
        <div class="card-title">💺 Seat Matrix</div>
        <div class="card-path">GET /api/v1/shows/:id/seats</div>
        <div class="card-desc">Real-time seat layout showing AVAILABLE, HELD, and BOOKED statuses with tier multipliers.</div>
      </a>

      <a href="/healthz" class="card" target="_blank">
        <div class="card-title">💓 Liveness Probe</div>
        <div class="card-path">GET /healthz</div>
        <div class="card-desc">Kubernetes/Docker liveness probe returning uptime, service version, and process health.</div>
      </a>

      <a href="/readyz" class="card" target="_blank">
        <div class="card-title">⚡ Readiness Probe</div>
        <div class="card-path">GET /readyz</div>
        <div class="card-desc">Verifies live database connectivity (PostgreSQL / SQLite) before accepting user traffic.</div>
      </a>

      <a href="/metrics" class="card" target="_blank">
        <div class="card-title">📊 Prometheus Metrics</div>
        <div class="card-path">GET /metrics</div>
        <div class="card-desc">Observability metrics: HTTP latency histograms, booking counters, seat hold gauges.</div>
      </a>

      <a href="https://github.com/arinkaushal/ALGIONS_AI_LABS" class="card" target="_blank">
        <div class="card-title">📦 Source Repository</div>
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

