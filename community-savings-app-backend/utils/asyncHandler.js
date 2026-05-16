// community-savings-app-backend/utils/asyncHandler.js

/**
 * Wraps an Express handler and forwards any error to `next(err)`.
 * Works for both sync and async handlers and prevents unhandled rejections.
 *
 * @param {Function} fn - Express handler: (req, res, next) => any|Promise<any>
 * @returns {Function} Wrapped handler that forwards errors to next().
 */
module.exports = function asyncHandler(fn) {
  const type = typeof fn;

  if (type !== 'function') {
    const name = fn && fn.name ? ` "${fn.name}"` : '';
    const msg = `asyncHandler expects a function, received ${type}${name || ''}`;
    // Instead of crashing the app, log a clear error and return a safe no-op handler
    console.error(`[AsyncHandler] ${msg}`);
    return function invalidAsyncHandler(req, res, next) {
      next(new TypeError(msg));
    };
  }

  // Name the wrapper for better stack traces in logs
  const wrapped = function wrappedAsyncHandler(req, res, next) {
    Promise.resolve()
      .then(() => fn(req, res, next))
      .catch((err) => {
        if (res.headersSent) {
          return next(err);
        }
        return next(err);
      });
  };

  // Preserve original name to aid diagnostics
  try {
    Object.defineProperty(wrapped, 'name', {
      value: fn.name || 'anonymousHandler',
      configurable: true,
    });
  } catch (_) {
    // ignore if not configurable
  }

  return wrapped;
};
