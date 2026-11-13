import express from 'express';
import bookingService from '../services/bookingService.js';

const router = express.Router();

/**
 * List all scheduled shows
 */
router.get('/shows', async (req, res, next) => {
  try {
    const shows = await bookingService.listShows();
    res.status(200).json({
      count: shows.length,
      shows
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Get show details
 */
router.get('/shows/:id', async (req, res, next) => {
  try {
    const show = await bookingService.getShow(req.params.id);
    res.status(200).json({ show });
  } catch (err) {
    next(err);
  }
});

/**
 * Get seat map and availability for a show
 */
router.get('/shows/:id/seats', async (req, res, next) => {
  try {
    const seatMap = await bookingService.getSeatMap(req.params.id);
    res.status(200).json(seatMap);
  } catch (err) {
    next(err);
  }
});

/**
 * Create a temporary seat hold
 */
router.post('/shows/:id/holds', async (req, res, next) => {
  try {
    const { seat_numbers, customer_email, duration_seconds } = req.body || {};
    const hold = await bookingService.createHold(
      req.params.id,
      seat_numbers,
      customer_email,
      duration_seconds
    );
    res.status(201).json({
      message: 'Temporary seat hold created successfully',
      hold
    });
  } catch (err) {
    next(err);
  }
});

export default router;

