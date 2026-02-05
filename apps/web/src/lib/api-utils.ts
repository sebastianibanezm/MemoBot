import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  rateLimitHeaders,
  RateLimitType,
} from "./rate-limit";

interface RateLimitOptions {
  type?: RateLimitType;
}

/**
 * Wrapper for API route handlers that adds rate limiting
 *
 * Usage:
 * ```ts
 * export const POST = withRateLimit(async (request) => {
 *   // Your handler code
 *   return NextResponse.json({ data });
 * }, { type: "chat" });
 * ```
 */
export function withRateLimit<T extends NextRequest>(
  handler: (request: T) => Promise<NextResponse>,
  options: RateLimitOptions = {}
) {
  const { type = "api" } = options;

  return async (request: T): Promise<NextResponse> => {
    // Get user ID if authenticated
    let userId: string | null = null;
    try {
      const authResult = await auth();
      userId = authResult.userId;
    } catch {
      // Not authenticated, will use IP
    }

    // Check rate limit
    const identifier = getRateLimitIdentifier(userId, request);
    const rateLimitResult = await checkRateLimit(identifier, type);

    // If rate limited, return 429
    if (!rateLimitResult.success) {
      const retryAfter = Math.ceil(
        (rateLimitResult.reset - Date.now()) / 1000
      );
      return new NextResponse(
        JSON.stringify({
          error: "Too many requests",
          message: "Please slow down and try again later",
          retryAfter,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": retryAfter.toString(),
            ...rateLimitHeaders(rateLimitResult),
          },
        }
      );
    }

    // Call the actual handler
    const response = await handler(request);

    // Add rate limit headers to successful response
    Object.entries(rateLimitHeaders(rateLimitResult)).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  };
}
