-- Cinema Hall Ticket Booking Service Schema
-- Compatible with both PostgreSQL 16+ and SQLite 3.35+

CREATE TABLE IF NOT EXISTS cinemas (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS halls (
    id TEXT PRIMARY KEY,
    cinema_id TEXT NOT NULL REFERENCES cinemas(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    total_capacity INTEGER NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS movies (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    rating TEXT NOT NULL,
    genre TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shows (
    id TEXT PRIMARY KEY,
    movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    hall_id TEXT NOT NULL REFERENCES halls(id) ON DELETE CASCADE,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    base_price REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS seats (
    id TEXT PRIMARY KEY,
    hall_id TEXT NOT NULL REFERENCES halls(id) ON DELETE CASCADE,
    seat_number TEXT NOT NULL,
    tier TEXT NOT NULL DEFAULT 'STANDARD',
    created_at TEXT NOT NULL,
    CONSTRAINT uq_hall_seat UNIQUE (hall_id, seat_number)
);

CREATE TABLE IF NOT EXISTS seat_holds (
    id TEXT PRIMARY KEY,
    show_id TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
    seat_number TEXT NOT NULL,
    hold_token TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    booking_reference TEXT NOT NULL UNIQUE,
    show_id TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    total_amount REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'CONFIRMED',
    qr_payload TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS booking_seats (
    id TEXT PRIMARY KEY,
    booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    show_id TEXT NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
    seat_number TEXT NOT NULL,
    price REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TEXT NOT NULL
);

-- Indices for performance and concurrency enforcement
CREATE INDEX IF NOT EXISTS idx_shows_movie_id ON shows(movie_id);
CREATE INDEX IF NOT EXISTS idx_shows_hall_id ON shows(hall_id);
CREATE INDEX IF NOT EXISTS idx_seats_hall ON seats(hall_id);
CREATE INDEX IF NOT EXISTS idx_seat_holds_show_seat ON seat_holds(show_id, seat_number);
CREATE INDEX IF NOT EXISTS idx_seat_holds_token ON seat_holds(hold_token);
CREATE INDEX IF NOT EXISTS idx_seat_holds_expiry ON seat_holds(expires_at);
CREATE INDEX IF NOT EXISTS idx_bookings_reference ON bookings(booking_reference);
CREATE INDEX IF NOT EXISTS idx_bookings_show_id ON bookings(show_id);

-- Enforce strict single confirmed booking per seat per show at database level
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_seat ON booking_seats(show_id, seat_number) WHERE status = 'ACTIVE';
