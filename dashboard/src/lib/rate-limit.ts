/**
 * In-memory fixed-window rate limiter.
 *
 * Single-node only (this VPS doesn't run multiple Next.js instances).
 * If we ever scale horizontally, swap the backing Map for Redis.
 *
 * Keyed by client identifier (typically IP). Each key gets a window of
 * WINDOW_MS milliseconds in which up to MAX_REQUESTS are allowed. Once
 * the window expires, the counter resets.
 *
 * The middleware should call `check(key)` AFTER auth has succeeded, so
 * unauthenticated traffic doesn't consume buckets.
 */

// ----- Configuration (sensible defaults, no env vars needed) -----
export const WINDOW_MS = 60_000; // 1 minute
export const MAX_REQUESTS = 60; // 60 req/min per key  → 1 req/sec average

// Cap the Map size so a flood of unique keys can't exhaust memory.
const MAX_TRACKED_KEYS = 10_000;

type Bucket = {
  count: number;
  // Epoch ms when the current window expires.
  resetAt: number;
};

const buckets: Map<string, Bucket> = new Map();

export type RateLimitResult = {
  allowed: boolean;
  // Remaining requests in the current window (0 when blocked).
  remaining: number;
  // Total quota for the window (echoed for X-RateLimit-Limit).
  limit: number;
  // Seconds until the bucket resets — used for Retry-After.
  retryAfterSeconds: number;
  // Epoch seconds when the window resets — used for X-RateLimit-Reset.
  resetAtEpochSeconds: number;
};

/**
 * Check whether `key` is allowed to make one more request right now.
 * Calling check() consumes one token from the bucket iff the request
 * is allowed (i.e. we DO count successful requests, we do NOT count
 * 429-rejected ones beyond the first overflow that defined the window).
 */
export function check(
  key: string,
  now: number = Date.now()
): RateLimitResult {
  // Periodic cleanup if we're tracking too many keys.
  if (buckets.size > MAX_TRACKED_KEYS) {
    evictExpired(now);
  }

  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    // New window.
    const resetAt = now + WINDOW_MS;
    buckets.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: MAX_REQUESTS - 1,
      limit: MAX_REQUESTS,
      retryAfterSeconds: 0,
      resetAtEpochSeconds: Math.ceil(resetAt / 1000),
    };
  }

  if (existing.count >= MAX_REQUESTS) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existing.resetAt - now) / 1000)
    );
    return {
      allowed: false,
      remaining: 0,
      limit: MAX_REQUESTS,
      retryAfterSeconds,
      resetAtEpochSeconds: Math.ceil(existing.resetAt / 1000),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: MAX_REQUESTS - existing.count,
    limit: MAX_REQUESTS,
    retryAfterSeconds: 0,
    resetAtEpochSeconds: Math.ceil(existing.resetAt / 1000),
  };
}

/**
 * Extract the best-effort client IP from a request's headers.
 * Falls back to "unknown" when nothing is available — all unknown
 * clients share a bucket, which is intentional (it caps total
 * unattributable traffic).
 */
export function clientKeyFromHeaders(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    // First entry is the original client per RFC 7239 convention.
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

/** Test-only helper: wipe state between tests. */
export function _resetForTests(): void {
  buckets.clear();
}

function evictExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}
