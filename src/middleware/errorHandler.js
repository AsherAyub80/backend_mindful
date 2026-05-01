// src/middleware/errorHandler.js

class AppError extends Error {
  constructor(message, statusCode = 500, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}

function errorHandler(err, req, res, next) {
  // Log error
  if (err.statusCode >= 500 || !err.isOperational) {
    console.error('❌ Error:', err.message, err.stack);
  }

  // Supabase errors
  if (err.code === 'PGRST116') {
    return res.status(404).json({ error: 'Resource not found' });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
  }

  // Zod validation errors
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.errors.map(e => ({ field: e.path.join('.'), message: e.message })),
    });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.isOperational ? err.message : 'Internal server error',
    code: err.code || null,
  });
}

module.exports = { AppError, errorHandler };
