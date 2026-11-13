import test from 'node:test';
import assert from 'node:assert/strict';
import db from '../src/db/index.js';
import migrate from '../src/db/migrate.js';
import seed from '../src/db/seed.js';
import bookingService from '../src/services/bookingService.js';
import { runBackup } from '../scripts/backup.js';
import { runRestore } from '../scripts/restore.js';
import { runRollback } from '../scripts/rollback.js';

import config from '../src/config.js';

test.before(async () => {
  config.databaseUrl = 'sqlite:./data/cinema-backup.test.db';
  await db.init('sqlite:./data/cinema-backup.test.db');
  await migrate();
  await seed();
});

test.after(async () => {
  await db.close();
});

test('ACCEPTANCE TEST 5: Automated database backup, mutation, restore, and integrity verification', async () => {
  const showId = 'show-interstellar-imax';
  const testSeat = ['A10'];

  // Clean test seat first
  await db.query(
    `DELETE FROM booking_seats WHERE show_id = ? AND seat_number = ?`,
    [showId, testSeat[0]]
  );

  // 1. Take baseline backup
  const backupMeta = await runBackup();
  assert.ok(backupMeta.backupFileName, 'Backup metadata must contain backup file name');
  assert.ok(backupMeta.checksum, 'Backup must generate SHA256 checksum');

  // 2. Perform state mutation (create new booking for A10)
  const booking = await bookingService.createBooking({
    show_id: showId,
    seat_numbers: testSeat,
    customer_name: 'Backup Tester',
    customer_email: 'tester@backup.test'
  });

  // Verify seat is currently booked
  const dbCheckBeforeRestore = await db.query(
    `SELECT count(*) as count FROM booking_seats WHERE show_id = ? AND seat_number = ? AND status = 'ACTIVE'`,
    [showId, testSeat[0]]
  );
  assert.equal(Number(dbCheckBeforeRestore.rows[0].count), 1, 'Seat A10 must be booked before restore');

  // 3. Restore database from pre-mutation backup
  const restoreResult = await runRestore(backupMeta.backupFilePath);
  assert.ok(restoreResult.restoredFrom, 'Restore must complete with source file');

  // 4. Verify post-restore state: mutated booking must be gone!
  const dbCheckAfterRestore = await db.query(
    `SELECT count(*) as count FROM booking_seats WHERE show_id = ? AND seat_number = ? AND status = 'ACTIVE'`,
    [showId, testSeat[0]]
  );
  assert.equal(
    Number(dbCheckAfterRestore.rows[0].count),
    0,
    'Post-restore state must confirm mutated booking was successfully reverted'
  );
});

test('ACCEPTANCE TEST 5 (Rollback Procedure): Documented and executable application rollback', async () => {
  const rollbackAudit = await runRollback({
    targetTag: 'v1.0.0-stable',
    restoreBackup: false
  });

  assert.equal(rollbackAudit.status, 'SUCCESS', 'Rollback execution must succeed');
  assert.equal(rollbackAudit.target_tag, 'v1.0.0-stable');
  assert.ok(rollbackAudit.actions_taken.length >= 3, 'Rollback must execute all verified steps');

  // Re-verify service readiness
  await db.init();
  const ready = await db.ping();
  assert.equal(ready, true, 'Service readiness must be verified post-rollback');
});

