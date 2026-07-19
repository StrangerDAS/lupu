import { logger } from '../utils/logger.js'

/**
 * Centralized error handler middleware.
 * Standardizes the error response shape across all endpoints.
 */
export function errorHandler(err, req, res, next) {
  const isProduction = process.env.NODE_ENV === 'production'
  
  // Log the error details with stack trace
  logger.error(`API Error: ${req.method} ${req.path}`, err, {
    method: req.method,
    path: req.path,
    headers: req.headers,
    query: req.query,
    body: req.body
  })

  // Set default status code if not already set or invalid
  const statusCode = res.statusCode && res.statusCode >= 400 ? res.statusCode : 500

  res.status(statusCode).json({
    success: false,
    message: isProduction && statusCode === 500 ? 'Internal server error' : err.message || 'Internal server error',
    ...(isProduction ? {} : { stack: err.stack })
  })
}
