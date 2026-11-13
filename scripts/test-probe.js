import http from 'http';
import createApp from '../src/app.js';
import db from '../src/db/index.js';
import migrate from '../src/db/migrate.js';
import seed from '../src/db/seed.js';

async function probe() {
  await db.init();
  await migrate();
  await seed();

  const app = createApp();
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(3099, '127.0.0.1', resolve));
  console.log('Test probe server listening on http://127.0.0.1:3099');

  try {
    const resHealth = await fetch('http://127.0.0.1:3099/healthz');
    console.log('HEALTHZ Status:', resHealth.status, await resHealth.json());

    const resReady = await fetch('http://127.0.0.1:3099/readyz');
    console.log('READYZ Status:', resReady.status, await resReady.json());

    const resShows = await fetch('http://127.0.0.1:3099/api/v1/shows');
    const showsData = await resShows.json();
    console.log('SHOWS Count:', showsData.count, 'First Show ID:', showsData.shows[0]?.id);

    const resSeats = await fetch(`http://127.0.0.1:3099/api/v1/shows/${showsData.shows[0].id}/seats`);
    const seatsData = await resSeats.json();
    console.log('SEATS Summary:', seatsData.summary);

    const resMetrics = await fetch('http://127.0.0.1:3099/metrics');
    const metricsText = await resMetrics.text();
    console.log('METRICS length:', metricsText.length, 'Contains cinema_http_requests_total:', metricsText.includes('cinema_http_requests_total'));

    console.log('PROBE SUCCESSFUL!');
  } finally {
    server.close();
    await db.close();
  }
}

probe().catch((err) => {
  console.error('Probe failed:', err);
  process.exit(1);
});

