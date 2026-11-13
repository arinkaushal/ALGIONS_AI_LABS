import crypto from 'crypto';
import db from '../db/index.js';
import config from '../config.js';
import logger from '../logger.js';
import { bookingOperationsTotal, activeSeatHoldsGauge } from '../metrics.js';

export class BookingService {
  /**
   * List all scheduled shows with real-time seat availability
   */
  async listShows() {
    const now = new Date().toISOString();

    const sql = `
      SELECT 
        s.id AS show_id,
        m.id AS movie_id,
        m.title AS movie_title,
        m.duration_minutes,
        m.rating,
        m.genre,
        h.id AS hall_id,
        h.name AS hall_name,
        h.total_capacity,
        s.start_time,
        s.end_time,
        s.base_price,
        s.status,
        (
          SELECT COUNT(*) 
          FROM seats st 
          WHERE st.hall_id = h.id
        ) AS total_seats,
        (
          SELECT COUNT(*)
          FROM booking_seats bs
          WHERE bs.show_id = s.id AND bs.status = 'ACTIVE'
        ) AS booked_seats,
        (
          SELECT COUNT(*)
          FROM seat_holds sh
          WHERE sh.show_id = s.id AND sh.expires_at > ?
        ) AS held_seats
      FROM shows s
      JOIN movies m ON s.movie_id = m.id
      JOIN halls h ON s.hall_id = h.id
      WHERE s.status = 'ACTIVE'
      ORDER BY s.start_time ASC
    `;

    const result = await db.query(sql, [now]);
    
    return result.rows.map((row) => {
      const total = Number(row.total_seats || row.total_capacity);
      const booked = Number(row.booked_seats || 0);
      const held = Number(row.held_seats || 0);
      const available = Math.max(0, total - booked - held);

      return {
        id: row.show_id,
        movie: {
          id: row.movie_id,
          title: row.movie_title,
          duration_minutes: row.duration_minutes,
          rating: row.rating,
          genre: row.genre
        },
        hall: {
          id: row.hall_id,
          name: row.hall_name,
          total_capacity: total
        },
        timing: {
          start_time: row.start_time,
          end_time: row.end_time
        },
        pricing: {
          base_price: Number(row.base_price)
        },
        seats: {
          total,
          booked,
          held,
          available
        },
        status: row.status
      };
    });
  }

  /**
   * Get single show details
   */
  async getShow(showId) {
    const shows = await this.listShows();
    const show = shows.find((s) => s.id === showId);
    if (!show) {
      const err = new Error(`Show with ID '${showId}' not found.`);
      err.statusCode = 404;
      err.code = 'SHOW_NOT_FOUND';
      throw err;
    }
    return show;
  }

  /**
   * Get complete seat map for a show with current status of each seat
   */
  async getSeatMap(showId) {
    const show = await this.getShow(showId);
    const now = new Date().toISOString();

    // 1. Get all seats configured for the hall
    const seatsRes = await db.query(
      `SELECT id, seat_number, tier FROM seats WHERE hall_id = ? ORDER BY seat_number ASC`,
      [show.hall.id]
    );

    // 2. Get active bookings for this show
    const bookedRes = await db.query(
      `SELECT seat_number FROM booking_seats WHERE show_id = ? AND status = 'ACTIVE'`,
      [showId]
    );
    const bookedSet = new Set(bookedRes.rows.map((r) => r.seat_number));

    // 3. Get active holds for this show
    const heldRes = await db.query(
      `SELECT seat_number, hold_token, expires_at FROM seat_holds WHERE show_id = ? AND expires_at > ?`,
      [showId, now]
    );
    const heldMap = new Map();
    heldRes.rows.forEach((r) => heldMap.set(r.seat_number, r));

    // Construct seat status grid
    const seatMap = seatsRes.rows.map((seat) => {
      let status = 'AVAILABLE';
      let holdInfo = null;

      if (bookedSet.has(seat.seat_number)) {
        status = 'BOOKED';
      } else if (heldMap.has(seat.seat_number)) {
        status = 'HELD';
        const hold = heldMap.get(seat.seat_number);
        holdInfo = {
          expires_at: hold.expires_at
        };
      }

      // Calculate price by tier
      const tierMultiplier = seat.tier === 'VIP' ? 1.25 : 1.0;
      const price = Math.round(show.pricing.base_price * tierMultiplier * 100) / 100;

      return {
        id: seat.id,
        seat_number: seat.seat_number,
        row: seat.seat_number.charAt(0),
        number: parseInt(seat.seat_number.substring(1), 10),
        tier: seat.tier,
        price,
        status,
        hold: holdInfo
      };
    });

    const summary = {
      total: seatMap.length,
      available: seatMap.filter((s) => s.status === 'AVAILABLE').length,
      held: seatMap.filter((s) => s.status === 'HELD').length,
      booked: seatMap.filter((s) => s.status === 'BOOKED').length
    };

    return {
      show_id: showId,
      hall_id: show.hall.id,
      summary,
      seats: seatMap
    };
  }

  /**
   * Create temporary seat hold
   */
  async createHold(showId, seatNumbers, customerEmail, durationSec = null) {
    if (!seatNumbers || !Array.isArray(seatNumbers) || seatNumbers.length === 0) {
      const err = new Error('seat_numbers must be a non-empty array of strings.');
      err.statusCode = 400;
      err.code = 'INVALID_SEATS';
      throw err;
    }

    if (!customerEmail || !customerEmail.includes('@')) {
      const err = new Error('A valid customer_email is required.');
      err.statusCode = 400;
      err.code = 'INVALID_EMAIL';
      throw err;
    }

    const show = await this.getShow(showId);
    const holdDuration = durationSec || config.holdDurationSeconds;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + holdDuration * 1000).toISOString();
    const nowIso = now.toISOString();
    const holdToken = `HOLD-${crypto.randomUUID()}`;

    // Clean expired holds for this show first
    await this.cleanExpiredHolds(showId);

    // Run hold reservation inside an isolated atomic transaction
    return await db.transaction(async (trx) => {
      for (const seatNum of seatNumbers) {
        // 1. Verify seat exists in hall
        const seatCheck = await trx.query(
          `SELECT id, tier FROM seats WHERE hall_id = ? AND seat_number = ?`,
          [show.hall.id, seatNum]
        );
        if (seatCheck.rows.length === 0) {
          const err = new Error(`Seat '${seatNum}' does not exist in hall '${show.hall.name}'.`);
          err.statusCode = 400;
          err.code = 'SEAT_NOT_FOUND';
          throw err;
        }

        // 2. Verify seat is not already confirmed booked
        const bookedCheck = await trx.query(
          `SELECT id FROM booking_seats WHERE show_id = ? AND seat_number = ? AND status = 'ACTIVE'`,
          [showId, seatNum]
        );
        if (bookedCheck.rows.length > 0) {
          bookingOperationsTotal.inc({ operation: 'hold', status: 'conflict' });
          const err = new Error(`Seat '${seatNum}' is already booked for show '${showId}'.`);
          err.statusCode = 409;
          err.code = 'SEAT_ALREADY_BOOKED';
          throw err;
        }

        // 3. Verify seat is not currently held by another active hold
        const holdCheck = await trx.query(
          `SELECT id, customer_email, expires_at FROM seat_holds WHERE show_id = ? AND seat_number = ? AND expires_at > ?`,
          [showId, seatNum, nowIso]
        );
        if (holdCheck.rows.length > 0) {
          bookingOperationsTotal.inc({ operation: 'hold', status: 'conflict' });
          const err = new Error(`Seat '${seatNum}' is temporarily held by another customer until ${holdCheck.rows[0].expires_at}.`);
          err.statusCode = 409;
          err.code = 'SEAT_ALREADY_HELD';
          throw err;
        }

        // 4. Create hold record
        const holdId = crypto.randomUUID();
        await trx.query(
          `INSERT INTO seat_holds (id, show_id, seat_number, hold_token, customer_email, expires_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [holdId, showId, seatNum, holdToken, customerEmail, expiresAt, nowIso]
        );
      }

      bookingOperationsTotal.inc({ operation: 'hold', status: 'success' });
      await this.updateActiveHoldMetric();

      return {
        hold_token: holdToken,
        show_id: showId,
        seat_numbers: seatNumbers,
        customer_email: customerEmail,
        expires_at: expiresAt,
        expires_in_seconds: holdDuration
      };
    });
  }

  /**
   * Confirm booking with atomic transaction and row locking
   * Guarantees that two concurrent attempts for the same seat CANNOT both confirm!
   */
  async createBooking({ show_id, seat_numbers, customer_name, customer_email, hold_token = null }) {
    if (!show_id) {
      const err = new Error('show_id is required.');
      err.statusCode = 400;
      err.code = 'MISSING_SHOW_ID';
      throw err;
    }

    if (!seat_numbers || !Array.isArray(seat_numbers) || seat_numbers.length === 0) {
      const err = new Error('seat_numbers must be a non-empty array of strings.');
      err.statusCode = 400;
      err.code = 'INVALID_SEATS';
      throw err;
    }

    if (!customer_name || customer_name.trim().length === 0) {
      const err = new Error('customer_name is required.');
      err.statusCode = 400;
      err.code = 'MISSING_CUSTOMER_NAME';
      throw err;
    }

    if (!customer_email || !customer_email.includes('@')) {
      const err = new Error('A valid customer_email is required.');
      err.statusCode = 400;
      err.code = 'INVALID_EMAIL';
      throw err;
    }

    const show = await this.getShow(show_id);
    const nowIso = new Date().toISOString();

    // Clean expired holds before processing
    await this.cleanExpiredHolds(show_id);

    try {
      return await db.transaction(async (trx) => {
        // If PostgreSQL, we can also perform row-level locking or table locking
        if (db.isPostgres()) {
          // Acquire an exclusive advisory transaction lock per show to serialize concurrent bookings
          // Deterministic hash of show_id guarantees serialization per show
          const hashInt = Math.abs(this.hashStringToInt(show_id));
          await trx.query(`SELECT pg_advisory_xact_lock(?)`, [hashInt]);
        }

        // If hold_token provided: verify all seats belong to this active hold
        if (hold_token) {
          const holdCheck = await trx.query(
            `SELECT seat_number, expires_at FROM seat_holds WHERE show_id = ? AND hold_token = ? AND expires_at > ?`,
            [show_id, hold_token, nowIso]
          );
          const heldSeatSet = new Set(holdCheck.rows.map((r) => r.seat_number));
          for (const seatNum of seat_numbers) {
            if (!heldSeatSet.has(seatNum)) {
              bookingOperationsTotal.inc({ operation: 'book', status: 'conflict' });
              const err = new Error(`Hold for seat '${seatNum}' is either expired or invalid for token '${hold_token}'.`);
              err.statusCode = 409;
              err.code = 'HOLD_EXPIRED_OR_INVALID';
              throw err;
            }
          }
        } else {
          // No hold token provided: check if any seat is held by anyone else
          for (const seatNum of seat_numbers) {
            const holdCheck = await trx.query(
              `SELECT seat_number, expires_at FROM seat_holds WHERE show_id = ? AND seat_number = ? AND expires_at > ?`,
              [show_id, seatNum, nowIso]
            );
            if (holdCheck.rows.length > 0) {
              bookingOperationsTotal.inc({ operation: 'book', status: 'conflict' });
              const err = new Error(`Seat '${seatNum}' is currently held by another user.`);
              err.statusCode = 409;
              err.code = 'SEAT_HELD_BY_ANOTHER';
              throw err;
            }
          }
        }

        // Check whether any requested seat is already booked with ACTIVE status
        for (const seatNum of seat_numbers) {
          const existingBooking = await trx.query(
            `SELECT b.booking_reference, bs.seat_number 
             FROM booking_seats bs 
             JOIN bookings b ON bs.booking_id = b.id 
             WHERE bs.show_id = ? AND bs.seat_number = ? AND bs.status = 'ACTIVE'`,
            [show_id, seatNum]
          );
          if (existingBooking.rows.length > 0) {
            bookingOperationsTotal.inc({ operation: 'book', status: 'conflict' });
            const err = new Error(`Seat '${seatNum}' is already booked for this show (Booking: ${existingBooking.rows[0].booking_reference}).`);
            err.statusCode = 409;
            err.code = 'SEAT_ALREADY_BOOKED';
            throw err;
          }
        }

        // Calculate pricing & seat details
        const bookedSeatDetails = [];
        let totalAmount = 0;

        for (const seatNum of seat_numbers) {
          const seatInfo = await trx.query(
            `SELECT id, tier FROM seats WHERE hall_id = ? AND seat_number = ?`,
            [show.hall.id, seatNum]
          );
          if (seatInfo.rows.length === 0) {
            const err = new Error(`Seat '${seatNum}' does not exist.`);
            err.statusCode = 400;
            err.code = 'SEAT_NOT_FOUND';
            throw err;
          }

          const tier = seatInfo.rows[0].tier;
          const tierMultiplier = tier === 'VIP' ? 1.25 : 1.0;
          const price = Math.round(show.pricing.base_price * tierMultiplier * 100) / 100;
          totalAmount += price;

          bookedSeatDetails.push({
            seat_number: seatNum,
            tier,
            price
          });
        }

        totalAmount = Math.round(totalAmount * 100) / 100;

        // Generate unique booking identifier
        const bookingId = crypto.randomUUID();
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
        const bookingReference = `TKT-${dateStr}-${randomHex}`;

        const qrPayload = JSON.stringify({
          ticket_id: bookingReference,
          show_id,
          movie: show.movie.title,
          seats: seat_numbers,
          customer: customer_name,
          issued_at: nowIso
        });

        // Insert booking master record
        await trx.query(
          `INSERT INTO bookings (id, booking_reference, show_id, customer_name, customer_email, total_amount, status, qr_payload, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [bookingId, bookingReference, show_id, customer_name.trim(), customer_email.trim(), totalAmount, 'CONFIRMED', qrPayload, nowIso, nowIso]
        );

        // Insert booked seats (enforces unique active seat index)
        for (const item of bookedSeatDetails) {
          const seatRecId = crypto.randomUUID();
          await trx.query(
            `INSERT INTO booking_seats (id, booking_id, show_id, seat_number, price, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [seatRecId, bookingId, show_id, item.seat_number, item.price, 'ACTIVE', nowIso]
          );
        }

        // Release/consume holds for these seats
        await trx.query(
          `DELETE FROM seat_holds WHERE show_id = ? AND seat_number IN (${seat_numbers.map(() => '?').join(',')})`,
          [show_id, ...seat_numbers]
        );

        bookingOperationsTotal.inc({ operation: 'book', status: 'success' });
        await this.updateActiveHoldMetric();

        logger.info('Booking confirmed successfully', {
          booking_reference: bookingReference,
          show_id,
          seats: seat_numbers,
          total_amount: totalAmount,
          customer_email
        });

        return {
          id: bookingId,
          booking_reference: bookingReference,
          show: {
            id: show.id,
            movie_title: show.movie.title,
            hall_name: show.hall.name,
            start_time: show.timing.start_time
          },
          customer: {
            name: customer_name.trim(),
            email: customer_email.trim()
          },
          seats: bookedSeatDetails,
          total_amount: totalAmount,
          status: 'CONFIRMED',
          qr_payload: qrPayload,
          created_at: nowIso
        };
      });
    } catch (err) {
      // Catch unique index violation or lock collision (concurrent duplicate booking attempt)
      if (
        err.message?.includes('UNIQUE constraint failed') ||
        err.message?.includes('duplicate key value') ||
        err.message?.includes('idx_unique_active_seat') ||
        err.message?.includes('cannot start a transaction') ||
        err.message?.includes('database is locked') ||
        err.code === '23505'
      ) {
        bookingOperationsTotal.inc({ operation: 'book', status: 'conflict' });
        const conflictErr = new Error('One or more of the selected seats were just booked by another user. Please choose another seat.');
        conflictErr.statusCode = 409;
        conflictErr.code = 'CONCURRENT_BOOKING_CONFLICT';
        throw conflictErr;
      }
      throw err;
    }
  }

  /**
   * Retrieve booking by ticket reference
   */
  async getBooking(reference) {
    const res = await db.query(
      `SELECT b.*, s.start_time, m.title AS movie_title, h.name AS hall_name
       FROM bookings b
       JOIN shows s ON b.show_id = s.id
       JOIN movies m ON s.movie_id = m.id
       JOIN halls h ON s.hall_id = h.id
       WHERE b.booking_reference = ?`,
      [reference]
    );

    if (res.rows.length === 0) {
      const err = new Error(`Booking with reference '${reference}' not found.`);
      err.statusCode = 404;
      err.code = 'BOOKING_NOT_FOUND';
      throw err;
    }

    const b = res.rows[0];
    const seatsRes = await db.query(
      `SELECT seat_number, price, status FROM booking_seats WHERE booking_id = ?`,
      [b.id]
    );

    return {
      id: b.id,
      booking_reference: b.booking_reference,
      show: {
        id: b.show_id,
        movie_title: b.movie_title,
        hall_name: b.hall_name,
        start_time: b.start_time
      },
      customer: {
        name: b.customer_name,
        email: b.customer_email
      },
      seats: seatsRes.rows,
      total_amount: Number(b.total_amount),
      status: b.status,
      qr_payload: b.qr_payload,
      created_at: b.created_at,
      updated_at: b.updated_at
    };
  }

  /**
   * Simulated cancellation: Frees the seat immediately and updates booking status
   */
  async cancelBooking(reference) {
    const nowIso = new Date().toISOString();

    return await db.transaction(async (trx) => {
      const res = await trx.query(
        `SELECT id, status, booking_reference FROM bookings WHERE booking_reference = ?`,
        [reference]
      );

      if (res.rows.length === 0) {
        const err = new Error(`Booking with reference '${reference}' not found.`);
        err.statusCode = 404;
        err.code = 'BOOKING_NOT_FOUND';
        throw err;
      }

      const booking = res.rows[0];
      if (booking.status === 'CANCELLED') {
        const err = new Error(`Booking '${reference}' is already cancelled.`);
        err.statusCode = 400;
        err.code = 'BOOKING_ALREADY_CANCELLED';
        throw err;
      }

      // Update booking status
      await trx.query(
        `UPDATE bookings SET status = 'CANCELLED', updated_at = ? WHERE id = ?`,
        [nowIso, booking.id]
      );

      // Update booking seats to CANCELLED (which frees the seat from the partial unique index)
      const seatRes = await trx.query(
        `SELECT seat_number FROM booking_seats WHERE booking_id = ?`,
        [booking.id]
      );
      const releasedSeats = seatRes.rows.map((r) => r.seat_number);

      await trx.query(
        `UPDATE booking_seats SET status = 'CANCELLED' WHERE booking_id = ?`,
        [booking.id]
      );

      bookingOperationsTotal.inc({ operation: 'cancel', status: 'success' });

      logger.info('Booking cancelled and seats released', {
        booking_reference: reference,
        released_seats: releasedSeats
      });

      return {
        booking_reference: reference,
        status: 'CANCELLED',
        released_seats: releasedSeats,
        refund_status: 'SIMULATED_REFUND_COMPLETED',
        cancelled_at: nowIso
      };
    });
  }

  /**
   * Remove expired seat holds
   */
  async cleanExpiredHolds(showId = null) {
    const nowIso = new Date().toISOString();
    try {
      if (showId) {
        await db.query(`DELETE FROM seat_holds WHERE show_id = ? AND expires_at <= ?`, [showId, nowIso]);
      } else {
        await db.query(`DELETE FROM seat_holds WHERE expires_at <= ?`, [nowIso]);
      }
      await this.updateActiveHoldMetric();
    } catch (err) {
      logger.warn('Failed cleaning expired holds', { error: err.message });
    }
  }

  async updateActiveHoldMetric() {
    try {
      const nowIso = new Date().toISOString();
      const res = await db.query(`SELECT COUNT(*) AS active_count FROM seat_holds WHERE expires_at > ?`, [nowIso]);
      const count = Number(res.rows[0]?.active_count || 0);
      activeSeatHoldsGauge.set(count);
    } catch (_) {}
  }

  hashStringToInt(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }
}

export const bookingService = new BookingService();
export default bookingService;
