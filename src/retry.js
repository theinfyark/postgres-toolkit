/**
 * Retry an async function with exponential backoff.
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{
 *   retries?: number,
 *   minDelayMs?: number,
 *   maxDelayMs?: number,
 *   factor?: number,
 *   shouldRetry?: (err: unknown, attempt: number) => boolean,
 *   onRetry?: (err: unknown, attempt: number, delayMs: number) => void
 * }} [options]
 * @returns {Promise<T>}
 */
export async function withRetry(fn, options = {}) {
  const retries = options.retries ?? 3;
  const minDelayMs = options.minDelayMs ?? 100;
  const maxDelayMs = options.maxDelayMs ?? 2000;
  const factor = options.factor ?? 2;
  const shouldRetry =
    options.shouldRetry ??
    ((err) => {
      const code = /** @type {{ code?: string }} */ (err)?.code;
      // Common transient pg / network codes
      return [
        "ECONNREFUSED",
        "ECONNRESET",
        "ETIMEDOUT",
        "EPIPE",
        "57P01", // admin_shutdown
        "57P02", // crash_shutdown
        "57P03", // cannot_connect_now
        "40001", // serialization_failure
        "40P01", // deadlock_detected
        "53300", // too_many_connections
      ].includes(String(code));
    });

  let attempt = 0;
  let delay = minDelayMs;

  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      if (attempt > retries || !shouldRetry(err, attempt)) throw err;
      const wait = Math.min(delay, maxDelayMs);
      options.onRetry?.(err, attempt, wait);
      await new Promise((r) => setTimeout(r, wait));
      delay *= factor;
    }
  }
}
