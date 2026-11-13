import config from './config.js';

const LOG_LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const currentLevelPriority = LOG_LEVELS[config.logLevel.toLowerCase()] || LOG_LEVELS.info;

function formatLog(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level: level.toUpperCase(),
    service: config.serviceName,
    version: config.version,
    message,
    ...meta
  };
  return JSON.stringify(logEntry);
}

export const logger = {
  debug(message, meta) {
    if (LOG_LEVELS.debug >= currentLevelPriority) {
      process.stdout.write(formatLog('debug', message, meta) + '\n');
    }
  },
  info(message, meta) {
    if (LOG_LEVELS.info >= currentLevelPriority) {
      process.stdout.write(formatLog('info', message, meta) + '\n');
    }
  },
  warn(message, meta) {
    if (LOG_LEVELS.warn >= currentLevelPriority) {
      process.stderr.write(formatLog('warn', message, meta) + '\n');
    }
  },
  error(message, meta) {
    if (LOG_LEVELS.error >= currentLevelPriority) {
      if (meta && meta.error instanceof Error) {
        meta.error = {
          name: meta.error.name,
          message: meta.error.message,
          stack: meta.error.stack
        };
      }
      process.stderr.write(formatLog('error', message, meta) + '\n');
    }
  }
};

export default logger;
