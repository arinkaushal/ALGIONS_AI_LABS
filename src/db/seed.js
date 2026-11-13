import { fileURLToPath } from 'url';
import crypto from 'crypto';
import db from './index.js';
import logger from '../logger.js';

export async function seed() {
  logger.info('Starting database seed...');
  const now = new Date().toISOString();

  // 1. Seed Cinema
  const cinemaId = 'cin-galaxy-01';
  await db.query(
    `INSERT OR IGNORE INTO cinemas (id, name, location, created_at) VALUES (?, ?, ?, ?)`,
    [cinemaId, 'Grand Galaxy Cinema', 'Downtown Metroplex, Screen Hall 1-4', now]
  ).catch(async () => {
    // If PostgreSQL (which uses ON CONFLICT DO NOTHING)
    await db.query(
      `INSERT INTO cinemas (id, name, location, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
      [cinemaId, 'Grand Galaxy Cinema', 'Downtown Metroplex, Screen Hall 1-4', now]
    );
  });

  // 2. Seed Halls
  const halls = [
    { id: 'hall-imax-01', name: 'Screen 1 - IMAX Laser', total_capacity: 40 },
    { id: 'hall-dolby-02', name: 'Screen 2 - Dolby Cinema', total_capacity: 30 }
  ];

  for (const h of halls) {
    try {
      await db.query(
        `INSERT OR IGNORE INTO halls (id, cinema_id, name, total_capacity, created_at) VALUES (?, ?, ?, ?, ?)`,
        [h.id, cinemaId, h.name, h.total_capacity, now]
      );
    } catch {
      await db.query(
        `INSERT INTO halls (id, cinema_id, name, total_capacity, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
        [h.id, cinemaId, h.name, h.total_capacity, now]
      );
    }
  }

  // 3. Seed Seats for Hall 1 (A1..A10, B1..B10, C1..C10, D1..D10)
  const hall1Rows = [
    { row: 'A', tier: 'STANDARD' },
    { row: 'B', tier: 'STANDARD' },
    { row: 'C', tier: 'VIP' },
    { row: 'D', tier: 'VIP' }
  ];

  for (const r of hall1Rows) {
    for (let i = 1; i <= 10; i++) {
      const seatNum = `${r.row}${i}`;
      const seatId = `seat-h1-${seatNum}`;
      try {
        await db.query(
          `INSERT OR IGNORE INTO seats (id, hall_id, seat_number, tier, created_at) VALUES (?, ?, ?, ?, ?)`,
          [seatId, 'hall-imax-01', seatNum, r.tier, now]
        );
      } catch {
        await db.query(
          `INSERT INTO seats (id, hall_id, seat_number, tier, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
          [seatId, 'hall-imax-01', seatNum, r.tier, now]
        );
      }
    }
  }

  // Seed Seats for Hall 2 (A1..A10, B1..B10, C1..C10)
  const hall2Rows = [
    { row: 'A', tier: 'STANDARD' },
    { row: 'B', tier: 'STANDARD' },
    { row: 'C', tier: 'VIP' }
  ];

  for (const r of hall2Rows) {
    for (let i = 1; i <= 10; i++) {
      const seatNum = `${r.row}${i}`;
      const seatId = `seat-h2-${seatNum}`;
      try {
        await db.query(
          `INSERT OR IGNORE INTO seats (id, hall_id, seat_number, tier, created_at) VALUES (?, ?, ?, ?, ?)`,
          [seatId, 'hall-dolby-02', seatNum, r.tier, now]
        );
      } catch {
        await db.query(
          `INSERT INTO seats (id, hall_id, seat_number, tier, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
          [seatId, 'hall-dolby-02', seatNum, r.tier, now]
        );
      }
    }
  }

  // 4. Seed Movies
  const movies = [
    {
      id: 'mov-interstellar',
      title: 'Interstellar: 10th Anniversary IMAX',
      duration_minutes: 169,
      rating: 'PG-13',
      genre: 'Sci-Fi / Adventure'
    },
    {
      id: 'mov-oppenheimer',
      title: 'Oppenheimer',
      duration_minutes: 180,
      rating: 'R',
      genre: 'Historical / Drama'
    },
    {
      id: 'mov-dune2',
      title: 'Dune: Part Two',
      duration_minutes: 166,
      rating: 'PG-13',
      genre: 'Sci-Fi / Action'
    }
  ];

  for (const m of movies) {
    try {
      await db.query(
        `INSERT OR IGNORE INTO movies (id, title, duration_minutes, rating, genre, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [m.id, m.title, m.duration_minutes, m.rating, m.genre, now]
      );
    } catch {
      await db.query(
        `INSERT INTO movies (id, title, duration_minutes, rating, genre, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
        [m.id, m.title, m.duration_minutes, m.rating, m.genre, now]
      );
    }
  }

  // 5. Seed Shows
  const shows = [
    {
      id: 'show-interstellar-imax',
      movie_id: 'mov-interstellar',
      hall_id: 'hall-imax-01',
      start_time: '2026-11-20T18:00:00Z',
      end_time: '2026-11-20T21:00:00Z',
      base_price: 18.50,
      status: 'ACTIVE'
    },
    {
      id: 'show-oppenheimer-dolby',
      movie_id: 'mov-oppenheimer',
      hall_id: 'hall-dolby-02',
      start_time: '2026-11-20T19:30:00Z',
      end_time: '2026-11-20T22:30:00Z',
      base_price: 16.00,
      status: 'ACTIVE'
    },
    {
      id: 'show-dune2-imax',
      movie_id: 'mov-dune2',
      hall_id: 'hall-imax-01',
      start_time: '2026-11-21T14:30:00Z',
      end_time: '2026-11-21T17:30:00Z',
      base_price: 18.50,
      status: 'ACTIVE'
    }
  ];

  for (const s of shows) {
    try {
      await db.query(
        `INSERT OR IGNORE INTO shows (id, movie_id, hall_id, start_time, end_time, base_price, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [s.id, s.movie_id, s.hall_id, s.start_time, s.end_time, s.base_price, s.status, now]
      );
    } catch {
      await db.query(
        `INSERT INTO shows (id, movie_id, hall_id, start_time, end_time, base_price, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING`,
        [s.id, s.movie_id, s.hall_id, s.start_time, s.end_time, s.base_price, s.status, now]
      );
    }
  }

  logger.info('Database seeded successfully with halls, seats, movies, and shows.');
}

// If executed directly from CLI: `node src/db/seed.js`
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  (async () => {
    try {
      await db.init();
      await seed();
      await db.close();
      process.exit(0);
    } catch (err) {
      console.error('Seed failed:', err);
      process.exit(1);
    }
  })();
}

export default seed;

