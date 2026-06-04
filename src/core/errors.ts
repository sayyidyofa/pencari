/**
 * Raised when a target platform signals rate limiting (e.g. HTTP 429).
 * Carries an optional cooldown so the worker can delay the job instead of
 * burning through retries.
 */
export class RateLimitError extends Error {
  constructor(public readonly retryAfterMs: number, message?: string) {
    super(message ?? 'Rate limited');
    this.name = 'RateLimitError';
  }
}

/**
 * Raised when authentication fails (e.g. expired/invalid session cookies).
 * These are unrecoverable without manual intervention.
 */
export class AuthenticationError extends Error {
  constructor(message?: string) {
    super(message ?? 'Authentication failed');
    this.name = 'AuthenticationError';
  }
}
