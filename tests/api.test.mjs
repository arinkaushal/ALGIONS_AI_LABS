import test from 'node:test';
import assert from 'node:assert/strict';
import db from '../src/db/index.js';
import migrate from '../src/db/migrate.js';
import seed from '../src/db/seed.js';
import bookingService from '../src/services/bookingService.js';
import { createApp } from '../src/app.js';

test.before(async () => {
  await db.init('sqlite:./data/cinema-api.test.db');
  await migrate();
  await seed();
});

test.after(async () => {
  await db.close();
});

test('Health and Readiness probes return correct statuses', async () => {
  const isHealthy = await db.ping();
  assert.equal(isHealthy, true, 'Database ping should return true');

  const app = createApp();
  assert.ok(app, 'Express app should be instantiated');
});

test('Show & Seat Map API: lists shows and returns real-time seat matrix', async () => {
  const shows = await bookingService.listShows();
  assert.ok(shows.length >= 3, 'Should list at least 3 active shows');

  const show = shows[0];
  assert.ok(show.id, 'Show must have an ID');
  assert.ok(show.movie.title, 'Show must have a movie title');
  assert.ok(show.hall.name, 'Show must have a hall name');

  const seatMap = await bookingService.getSeatMap(show.id);
  assert.equal(seatMap.show_id, show.id);
  assert.ok(seatMap.seats.length > 0, 'Seat map must contain seats');
  assert.equal(seatMap.summary.total, seatMap.seats.length);
  assert.equal(typeof seatMap.summary.available, 'number');
});

test('Temporary Seat Hold: creates hold with expiration and locks seat', async () => {
  const showId = 'show-oppenheimer-dolby';
  const targetSeats = ['B1', 'B2'];

  // Clean seats for isolation
  await db.query(`DELETE FROM booking_seats WHERE show_id = ? AND seat_number IN ('B1', 'B2')`, [showId]);
  await db.query(`DELETE FROM seat_holds WHERE show_id = ? AND seat_number IN ('B1', 'B2')`, [showId]);

  const hold = await bookingService.createHold(showId, targetSeats, 'temp@cinema.com', 5);
  assert.ok(hold.hold_token.startsWith('HOLD-'), 'Hold token should be generated');
  assert.deepEqual(hold.seat_numbers, targetSeats);
  assert.ok(new Date(hold.expires_at) > new Date());

  // Verify seat map reflects HELD status
  const seatMap = await bookingService.getSeatMap(showId);
  const heldSeats = seatMap.seats.filter((s) => targetSeats.includes(s.seat_number));
  for (const s of heldSeats) {
    assert.equal(s.status, 'HELD', `Seat ${s.seat_number} should be in HELD status`);
  }

  // Attempting to hold the same seat while active should fail with 409
  await assert.rejects(
    async () => {
      await bookingService.createHold(showId, ['B1'], 'other@cinema.com', 5);
    },
    (err) => {
      assert.equal(err.statusCode, 409);
      assert.equal(err.code, 'SEAT_ALREADY_HELD');
      return true;
    }
  );
});

test('Booking Creation: confirms booking, generates ticket ID, and marks seats BOOKED', async () => {
  const showId = 'show-dune2-imax';
  const targetSeats = ['C1', 'C2'];

  // Clean seats for isolation
  await db.query(`DELETE FROM booking_seats WHERE show_id = ? AND seat_number IN ('C1', 'C2')`, [showId]);
  await db.query(`DELETE FROM seat_holds WHERE show_id = ? AND seat_number IN ('C1', 'C2')`, [showId]);

  const booking = await bookingService.createBooking({
    show_id: showId,
    seat_numbers: targetSeats,
    customer_name: 'John Doe',
    customer_email: 'john@example.com'
  });

  assert.ok(booking.booking_reference.startsWith('TKT-'), 'Booking reference should match TKT prefix format');
  assert.equal(booking.status, 'CONFIRMED');
  assert.equal(booking.seats.length, 2);
  assert.ok(booking.total_amount > 0);
  assert.ok(booking.qr_payload, 'QR payload should be present');

  // Verify retrieval
  const retrieved = await bookingService.getBooking(booking.booking_reference);
  assert.equal(retrieved.booking_reference, booking.booking_reference);
  assert.equal(retrieved.status, 'CONFIRMED');

  // Verify seat map reflects BOOKED status
  const seatMap = await bookingService.getSeatMap(showId);
  const bookedSeats = seatMap.seats.filter((s) => targetSeats.includes(s.seat_number));
  for (const s of bookedSeats) {
    assert.equal(s.status, 'BOOKED', `Seat ${s.seat_number} should be in BOOKED status`);
  }
});

test('Simulated Cancellation: cancels booking and releases seats back to AVAILABLE', async () => {
  const showId = 'show-dune2-imax';
  const targetSeats = ['D5'];

  // Clean seats for isolation
  await db.query(`DELETE FROM booking_seats WHERE show_id = ? AND seat_number = 'D5'`, [showId]);
  await db.query(`DELETE FROM seat_holds WHERE show_id = ? AND seat_number = 'D5'`, [showId]);

  const booking = await bookingService.createBooking({
    show_id: showId,
    seat_numbers: targetSeats,
    customer_name: 'Jane Smith',
    customer_email: 'jane@example.com'
  });

  const cancellation = await bookingService.cancelBooking(booking.booking_reference);
  assert.equal(cancellation.status, 'CANCELLED');
  assert.deepEqual(cancellation.released_seats, targetSeats);

  // Verify seat is available again
  const seatMap = await bookingService.getSeatMap(showId);
  const seat = seatMap.seats.find((s) => s.seat_number === 'D5');
  assert.equal(seat.status, 'AVAILABLE', 'Seat should be AVAILABLE after cancellation');

  // Verify booking retrieval reflects CANCELLED status
  const retrieved = await bookingService.getBooking(booking.booking_reference);
  assert.equal(retrieved.status, 'CANCELLED');
});
