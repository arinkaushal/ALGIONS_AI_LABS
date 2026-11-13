import logger from '../logger.js';

export function errorHandlerMiddleware(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const errorCode = err.code || (statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST');
  const message = err.message || 'An unexpected error occurred.';

  const isServerFault = statusCode >= 500;

  if (isServerFault) {
    logger.error('Unhandled internal server error', {
      requestId: req.id,
      error: err,
      path: req.originalUrl,
      method: req.method
    });
  }

  res.status(statusCode).json({
    error: {
      code: errorCode,
      message,
      status: statusCode,
      request_id: req.id,
      timestamp: new Date().toISOString()
    }
  });
}

export default errorHandlerMiddleware;
