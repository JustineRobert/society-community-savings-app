// middlewares/errorMiddleware.js

/**
 * Global Error Handler Middleware
 *
 * ✅ Handles all errors in one place
 * ✅ Supports Mongoose, validation, and custom errors
 * ✅ Prevents stack leaks in production
 * ✅ Standardizes API responses
 */

module.exports = (err, req, res, next) => {
  // ✅ Default error values
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";

  // ✅ Clone error (avoid mutation issues)
  let error = { ...err };
  error.message = err.message;

  // ✅ Mongoose: Invalid ObjectId
  if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid resource ID: ${err.value}`;
  }

  // ✅ Mongoose: Duplicate key
  if (err.code && err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue)[0];
    message = `Duplicate value for field: ${field}`;
  }

  // ✅ Mongoose: Validation error
  if (err.name === "ValidationError") {
    statusCode = 400;
    const errors = Object.values(err.errors).map((e) => e.message);
    message = errors.join(", ");
  }

  // ✅ Custom known errors (optional pattern)
  if (err.name === "UnauthorizedError") {
    statusCode = 401;
  }

  if (err.name === "ForbiddenError") {
    statusCode = 403;
  }

  // ✅ Log error (important for MTN-grade systems)
  console.error("❌ Error:", {
    message: err.message,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
  });

  // ✅ Production-safe response
  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && {
      stack: err.stack,
    }),
  });
};