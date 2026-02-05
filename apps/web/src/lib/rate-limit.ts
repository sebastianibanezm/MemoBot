import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limit configurations for different endpoint types
 */
export const RATE_LIMITS = {
  // General API: 60 requests per minute
  api: { requests: 60, window: "60 s" as const },
  // Auth endpoints: 10 requests per minute (stricter)
  auth: { requests: 10, window: "60 s" as const },
  // Chat/AI endpoints: 20 requests per minute
  chat: { requests: 20, window: "60 s" as const },
  // Memory operations: 30 requests per minute
  memory: { requests: 30, window: "60 s" as const },
  // Webhooks: 100 requests per minute (higher for external services)
  webhook: { requests: 100, window: "60 s" as const },
} as const;

export type RateLimitType = keyof typeof RATE_LIMITS;

// Store for rate limiters (lazy initialization)
const rateLimiters = new Map<RateLimitType, Ratelimit>();

/**
 * Get or create a rate limiter for a specific type
 */
function getRateLimiter(type: RateLimitType): Ratelimit | null {
  // Check if Upstash is configured
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    // In development without Upstash, skip rate limiting
    if (process.env.NODE_ENV === "development") {
      console.warn("[rate-limit] Upstash not configured, skipping rate limit");
      return null;
    }
    console.error("[rate-limit] Upstash not configured in production!");
    return null;
  }

  // Return cached limiter if exists
  if (rateLimiters.has(type)) {
    return rateLimiters.get(type)!;
  }

  // Create new limiter
  const config = RATE_LIMITS[type];
  const limiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(config.requests, config.window),
    prefix: `ratelimit:${type}`,
    analytics: true,
  });

  rateLimiters.set(type, limiter);
  return limiter;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp when the limit resets
}

/**
 * Check rate limit for an identifier (usually userId or IP)
 */
export async function checkRateLimit(
  identifier: string,
  type: RateLimitType = "api"
): Promise<RateLimitResult> {
  const limiter = getRateLimiter(type);

  // If no limiter (dev without Upstash), allow all
  if (!limiter) {
    return {
      success: true,
      limit: RATE_LIMITS[type].requests,
      remaining: RATE_LIMITS[type].requests,
      reset: Date.now() + 60000,
    };
  }

  const result = await limiter.limit(identifier);

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}

/**
 * Get rate limit headers for response
 */
export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": result.reset.toString(),
  };
}

/**
 * Get identifier for rate limiting from request
 * Uses userId if authenticated, otherwise falls back to IP
 */
export function getRateLimitIdentifier(
  userId: string | null,
  request: Request
): string {
  if (userId) return `user:${userId}`;

  // Get IP from various headers (Vercel, Cloudflare, etc.)
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfIp = request.headers.get("cf-connecting-ip");

  const ip = cfIp || realIp || forwarded?.split(",")[0]?.trim() || "unknown";
  return `ip:${ip}`;
}
