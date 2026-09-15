'use strict';

/**
 * Catches anything that bubbles past route handlers. Deliberately does
 * not leak internal error details (stack traces, DB errors, etc.) to
 * clients — those go to server-side logs only.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error('[LAVA License Server] Unhandled error:', err);

  if (res.headersSent) {
    return next(err);
  }

  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred.',
  });
}

module.exports = { errorHandler };
