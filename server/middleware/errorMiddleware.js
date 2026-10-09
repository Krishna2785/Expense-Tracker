// server/middleware/errorMiddleware.js
// Centralized error handling middleware for the Express application.

/**
 * Catches any request that does not match any defined route.
 * Passes a 404 error down to the central errorHandler.
 */
const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

/**
 * Central Error Handler.
 * Intercepts all errors, formats friendly messages, and assigns proper HTTP status codes.
 * Prevents Mongoose client errors (invalid IDs, duplicate keys, validation rules) from returning 500.
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message || 'Server Error';

  // 1. Mongoose Bad ObjectId (CastError) -> 404 Not Found
  // Example: requesting /api/expenses/12345 (which is not a valid 24-char ObjectId)
  if (err.name === 'CastError') {
    statusCode = 404;
    message = `Resource not found. Invalid ID format: '${err.value}'`;
  }

  // 2. Mongoose Duplicate Key Error (Code 11000) -> 400 Bad Request
  // Example: registering an email or budget category that already exists
  if (err.code === 11000) {
    statusCode = 400;
    const duplicateFields = Object.keys(err.keyValue || {}).join(', ');
    message = `Duplicate value entered for: ${duplicateFields}. Please use a different value.`;
  }

  // 3. Mongoose Schema Validation Error -> 400 Bad Request
  // Example: omitting a required field or violating minLength/min
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors || {})
      .map((val) => val.message)
      .join(', ');
  }

  // 4. JWT Verification Errors -> 401 Unauthorized
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Not authorized: Token signature is invalid';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Not authorized: Token has expired';
  }

  res.status(statusCode).json({
    success: false,
    message,
    // In development mode, display the stack trace for easier debugging; hide it in production
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

module.exports = {
  notFound,
  errorHandler,
};
