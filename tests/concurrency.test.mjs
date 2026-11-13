import test from 'node:test';
import assert from 'node:assert/strict';
import db from '../src/db/index.js';
import migrate from '../src/db/migrate.js';
import seed from '../src/db/seed.js';
import bookingService from '../src/services/bookingService.js';

test.before(async () => {
  await db.init('sqlite:./data/cinema-concurrency.test.db');
  await migrate();
  await seed();
});

test.after(async () => {
  await db.close();
});

test('ACCEPTANCE TEST 1: Two concurrent attempts for the same show/seat cannot both confirm', async () => {
  const showId = 'show-interstellar-imax';
  const targetSeat = ['B2'];

  // Clean any existing booking for this test seat to ensure isolation
  await db.query(
    `DELETE FROM booking_seats WHERE show_id = ? AND seat_number = ?`,
    [showId, targetSeat[0]]
  );

  const request1 = bookingService.createBooking({
    show_id: showId,
    seat_numbers: targetSeat,
    customer_name: 'Concurrent User 1',
    customer_email: 'user1@concurrency.test'
  });

  const request2 = bookingService.createBooking({
    show_id: showId,
    seat_numbers: targetSeat,
    customer_name: 'Concurrent User 2',
    customer_email: 'user2@concurrency.test'
  });

  const results = await Promise.allSettled([request1, request2]);

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');

  assert.equal(fulfilled.length, 1, 'Exactly one concurrent booking attempt must confirm');
  assert.equal(rejected.length, 1, 'Exactly one concurrent booking attempt must be rejected');

  const confirmedBooking = fulfilled[0].value;
  assert.ok(confirmedBooking.booking_reference, 'Confirmed booking must have a reference');
  assert.equal(confirmedBooking.status, 'CONFIRMED');

  const rejectionReason = rejected[0].reason;
  assert.equal(rejectionReason.statusCode, 409, 'Rejected booking must fail with HTTP 409 Conflict');
  assert.ok(
    rejectionReason.code === 'SEAT_ALREADY_BOOKED' || rejectionReason.code === 'CONCURRENT_BOOKING_CONFLICT',
    `Expected 409 conflict code, got ${rejectionReason.code}`
  );

  // Verify database state: exactly 1 active booking seat exists
  const dbCheck = await db.query(
    `SELECT count(*) as count FROM booking_seats WHERE show_id = ? AND seat_number = ? AND status = 'ACTIVE'`,
    [showId, targetSeat[0]]
  );
  assert.equal(Number(dbCheck.rows[0].count), 1, 'Database must have exactly 1 active booking for target seat');
});

test('ACCEPTANCE TEST 1 (High Concurrency Stress): 20 simultaneous concurrent attempts for same seat', async () => {
  const showId = 'show-interstellar-imax';
  const targetSeat = ['B3'];
  const concurrencyCount = 20;

  // Clean any existing booking for this test seat
  await db.query(
    `DELETE FROM booking_seats WHERE show_id = ? AND seat_number = ?`,
    [showId, targetSeat[0]]
  );

  const promises = Array.from({ length: concurrencyCount }, (_, i) => {
    return bookingService.createBooking({
      show_id: showId,
      seat_numbers: targetSeat,
      customer_name: `Stress User ${i}`,
      customer_email: `stress_${i}@concurrency.test`
    });
  });

  const results = await Promise.allSettled(promises);

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');

  assert.equal(fulfilled.length, 1, `Under 20-thread concurrency, exactly 1 must confirm`);
  assert.equal(rejected.length, concurrencyCount - 1, `Under 20-thread concurrency, 19 must be rejected`);

  // Verify all 19 rejections were 409 Conflict
  for (const rej of rejected) {
    assert.equal(rej.reason.statusCode, 409, `Rejection error must have statusCode 409, got ${rej.reason.statusCode}`);
  }

  // Verify database row count
  const dbCheck = await db.query(
    `SELECT count(*) as count FROM booking_seats WHERE show_id = ? AND seat_number = ? AND status = 'ACTIVE'`,
    [showId, targetSeat[0]]
  );
  assert.equal(Number(dbCheck.rows[0].count), 1, 'Database must contain exactly 1 active record');
});

test('ACCEPTANCE TEST 1 (Overlapping Multi-Seat Concurrency): Two concurrent attempts with overlapping seats', async () => {
  const showId = 'show-interstellar-imax';
  
  // Clean test seats
  await db.query(
    `DELETE FROM booking_seats WHERE show_id = ? AND seat_number IN ('C7', 'C8', 'C9')`,
    [showId]
  );

  // User A attempts C7, C8
  // User B attempts C8, C9 (overlapping on C8)
  const reqA = bookingService.createBooking({
    show_id: showId,
    seat_numbers: ['C7', 'C8'],
    customer_name: 'Multi User A',
    customer_email: 'userA@concurrency.test'
  });

  const reqB = bookingService.createBooking({
    show_id: showId,
    seat_numbers: ['C8', 'C9'],
    customer_name: 'Multi User B',
    customer_email: 'userB@concurrency.test'
  });

  const results = await Promise.allSettled([reqA, reqB]);
  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');

  assert.equal(fulfilled.length, 1, 'Only one of the overlapping bookings can succeed');
  assert.equal(rejected.length, 1, 'The other overlapping booking must be rejected with 409');
  assert.equal(rejected[0].reason.statusCode, 409);
});
