import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env if present
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  serviceName: 'cinema-ticket-reservation-service',
  version: process.env.APP_VERSION || '1.0.0',
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Database configuration
  databaseUrl: process.env.DATABASE_URL || 'sqlite:./data/cinema.db',
  dbMaxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
  dbIdleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10),
  dbConnectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '5000', 10),
  
  // Seat hold policy
  holdDurationSeconds: parseInt(process.env.HOLD_DURATION_SECONDS || '300', 10), // default 5 minutes
  holdCleanupIntervalMs: parseInt(process.env.HOLD_CLEANUP_INTERVAL_MS || '30000', 10), // 30s background scan
  
  // Security & CORS
  corsOrigin: process.env.CORS_ORIGIN || '*',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '120', 10)
};

export default config;
