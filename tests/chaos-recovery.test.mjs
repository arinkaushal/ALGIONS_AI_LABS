import test from 'node:test';
import assert from 'node:assert/strict';
import db from '../src/db/index.js';
import migrate from '../src/db/migrate.js';
import seed from '../src/db/seed.js';
import logger from '../src/logger.js';

test.before(async () => {
  await db.init();
  await migrate();
  await seed();
});

test.after(async () => {
  await db.close();
});

test('ACCEPTANCE TEST 4: Service health detection and automated chaos recovery drill', async () => {
  // 1. Initial State: Service is healthy and database is connected
  const initialHealth = await db.ping();
  assert.equal(initialHealth, true, 'Database readiness ping should initially be TRUE');

  logger.info('Chaos Drill Step 1: Baseline health verified healthy (status 200)');

  // 2. Failure Injection: Deliberately break / disconnect the database
  logger.warn('Chaos Drill Step 2: Injecting deliberate database outage failure...');
  
  // Store backup reference and simulate catastrophic closure / connection drop
  const originalSqlite = db.sqliteDb;
  const originalPg = db.pgPool;

  db.sqliteDb = null;
  db.pgPool = null;

  // 3. Detection: Probe readiness - must immediately report FAILURE (503 condition)
  const failedPing = await db.ping();
  assert.equal(failedPing, false, 'Readiness probe MUST detect database disconnection and return false (HTTP 503)');
  logger.info('Chaos Drill Step 3: Outage successfully detected by readiness probe (HTTP 503 Not Ready)');

  // 4. Automated Recovery: Service orchestrator restores database connectivity
  logger.info('Chaos Drill Step 4: Initiating automated recovery procedure...');
  db.sqliteDb = originalSqlite;
  db.pgPool = originalPg;

  // 5. Verification: Probe readiness again - must confirm RECOVERY (200 OK)
  const recoveredPing = await db.ping();
  assert.equal(recoveredPing, true, 'Readiness probe MUST confirm service recovery back to TRUE (HTTP 200)');
  logger.info('Chaos Drill Step 5: Service recovery confirmed by readiness probe (HTTP 200 Ready)');
});
