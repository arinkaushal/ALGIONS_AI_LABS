import express from 'express';
import bookingService from '../services/bookingService.js';

const router = express.Router();

/**
 * Confirm reservation / Create ticket booking
 * Guaranteed atomic transaction enforcing single booking per seat per show
 */
router.post('/bookings', async (req, res, next) => {
  try {
    const booking = await bookingService.createBooking(req.body || {});
    res.status(201).json({
      message: 'Booking confirmed successfully',
      booking
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Get booking details by ticket reference
 */
router.get('/bookings/:reference', async (req, res, next) => {
  try {
    const booking = await bookingService.getBooking(req.params.reference);
    res.status(200).json({ booking });
  } catch (err) {
    next(err);
  }
});

/**
 * Simulated cancellation: Releases seat and marks booking cancelled
 */
router.post('/bookings/:reference/cancel', async (req, res, next) => {
  try {
    const result = await bookingService.cancelBooking(req.params.reference);
    res.status(200).json({
      message: 'Booking cancelled successfully and seats released',
      cancellation: result
    });
  } catch (err) {
    next(err);
  }
});

export default router;
