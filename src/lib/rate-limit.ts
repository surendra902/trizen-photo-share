interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

/**
 * In-memory rate limiter per key (e.g. IP + action / slug).
 * Cleans up expired entries periodically to prevent memory leaks.
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number = 10,
  windowSeconds: number = 15 * 60
): { allowed: boolean; remaining: number; resetSeconds: number } {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  // Clean up if expired
  if (!record || now > record.resetTime) {
    const resetTime = now + windowSeconds * 1000;
    rateLimitStore.set(key, { count: 1, resetTime });
    return {
      allowed: true,
      remaining: maxAttempts - 1,
      resetSeconds: windowSeconds,
    };
  }

  if (record.count >= maxAttempts) {
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetSeconds: Math.max(1, resetSeconds),
    };
  }

  record.count += 1;
  const resetSeconds = Math.ceil((record.resetTime - now) / 1000);
  return {
    allowed: true,
    remaining: maxAttempts - record.count,
    resetSeconds: Math.max(1, resetSeconds),
  };
}

// Memory cleanup every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      if (now > record.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  }, 10 * 60 * 1000).unref?.();
}
