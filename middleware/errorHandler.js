/**
 * Global error handling middleware for Express
 * Catches and formats all errors into consistent JSON responses
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // ── Mongoose: Bad ObjectId ─────────────────────────────────────────
  if (err.name === 'CastError') {
    statusCode = 404;
    message = `Resource not found`;
  }

  // ── Mongoose: Duplicate Key ────────────────────────────────────────
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue)[0];
    message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
  }

  // ── Mongoose: Validation Error ─────────────────────────────────────
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
  }

  // ── JWT: Invalid Token ─────────────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
  }

  // ── JWT: Expired Token ─────────────────────────────────────────────
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token has expired';
  }

  // ── Axios: External Request Error ──────────────────────────────────
  if (err.isAxiosError) {
    statusCode = 502;
    message = `Upstream request failed: ${err.message}`;
  }

  // Log server errors
  if (statusCode >= 500) {
    console.error(`❌ [${new Date().toISOString()}] ${statusCode} — ${message}`);
    if (process.env.NODE_ENV === 'development') {
      console.error(err.stack);
    }
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
