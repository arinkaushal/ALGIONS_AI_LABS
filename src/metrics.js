import client from 'prom-client';

const register = new client.Registry();

// Enable default runtime metrics (memory, event loop lag, cpu)
client.collectDefaultMetrics({
  register,
  prefix: 'cinema_'
});

// Custom application metrics
export const httpRequestsTotal = new client.Counter({
  name: 'cinema_http_requests_total',
  help: 'Total number of HTTP requests processed',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

export const httpRequestDurationSeconds = new client.Histogram({
  name: 'cinema_http_request_duration_seconds',
  help: 'Histogram of HTTP request durations in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register]
});

export const bookingOperationsTotal = new client.Counter({
  name: 'cinema_booking_operations_total',
  help: 'Total count of booking operations by operation and status',
  labelNames: ['operation', 'status'], // operation: hold, book, cancel; status: success, conflict, error
  registers: [register]
});

export const activeSeatHoldsGauge = new client.Gauge({
  name: 'cinema_active_seat_holds',
  help: 'Current number of active unexpired seat holds',
  registers: [register]
});

export const databaseConnectedGauge = new client.Gauge({
  name: 'cinema_database_connected',
  help: 'Database connection health status (1 = connected, 0 = disconnected)',
  registers: [register]
});

export { register };
export default {
  register,
  httpRequestsTotal,
  httpRequestDurationSeconds,
  bookingOperationsTotal,
  activeSeatHoldsGauge,
  databaseConnectedGauge
};
