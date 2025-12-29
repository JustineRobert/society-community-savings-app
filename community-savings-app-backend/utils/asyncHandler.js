
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
    throw new TypeError(
      `asyncHandler expects a function, received ${type}${name || ''}`
    );
  }

  // Name the wrapper for better stack traces in logs
  const wrapped = function wrappedAsyncHandler(req, res, next) {
    // Use a resolved promise to ensure sync throws are captured in .catch
    Promise.resolve()
      .then(() => fn(req, res, next))
      .catch((err) => {
        // If response already started, delegate to Express to finish correctly
        if (res.headersSent) {
          return next(err);
        }
        return next(err);
      });
  };

  // Preserve original name to aid diagnostics (non-enumerable)
  try {
    Object.defineProperty(wrapped, 'name', {
      value: fn.name || 'anonymousHandler',
      configurable: true,
    });
  } catch (_) {
    // ignore if not configurable in this environment
  }

  return wrapped;
};
