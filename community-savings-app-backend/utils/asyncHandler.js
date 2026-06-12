// middlewares/asyncHandler.js

/**
 * asyncHandler - Wraps Express route handlers to catch both sync and async errors
 * and forward them to the global error handler via `next(err)`.
 *
 * ✅ Prevents unhandled promise rejections
 * ✅ Works with both sync and async functions
 * ✅ Adds validation for safer usage
 * ✅ Improves debugging with named wrappers
 *
 * @param {Function} fn - Express handler (req, res, next) => Promise|void
 * @returns {Function} Wrapped Express middleware
 */
module.exports = function asyncHandler(fn) {
  // ✅ Validate input
  if (typeof fn !== "function") {
    const name = fn && fn.name ? ` "${fn.name}"` : "";
    const message = `asyncHandler expects a function, received ${typeof fn}${name}`;

    console.error(`[AsyncHandler Error] ${message}`);

    return function invalidAsyncHandler(req, res, next) {
      return next(new TypeError(message));
    };
  }

  // ✅ Wrapper
  const wrappedHandler = function asyncWrappedHandler(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      // ✅ Prevent duplicate responses
      if (res.headersSent) {
        return next(err);
      }

      return next(err);
    });
  };

  // ✅ Preserve function name for better debugging
  try {
    Object.defineProperty(wrappedHandler, "name", {
      value: fn.name || "anonymousHandler",
      configurable: true,
    });
  } catch (err) {
    // ignore if not configurable
  }

  return wrappedHandler;
};