import { NextRequest, NextResponse } from "next/server";

/**
 * Allowed origins for CORS. Add your production domain here.
 */
const ALLOWED_ORIGINS: (string | RegExp)[] = [
  // Production
  "https://memo-bot.com",
  "https://www.memo-bot.com",
  // Vercel preview deployments
  /^https:\/\/memobot-.*\.vercel\.app$/,
  // Local development
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

/**
 * Check if an origin is allowed
 */
export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;

  // Check environment variable override
  const envOrigins = process.env.ALLOWED_ORIGINS?.split(",").map((o) =>
    o.trim()
  );
  if (envOrigins?.includes(origin)) return true;

  return ALLOWED_ORIGINS.some((allowed) => {
    if (typeof allowed === "string") {
      return allowed === origin;
    }
    // RegExp for pattern matching (Vercel previews)
    return allowed.test(origin);
  });
}

/**
 * Get CORS headers for a request
 */
export function getCorsHeaders(request: NextRequest): HeadersInit {
  const origin = request.headers.get("origin");

  // If origin is allowed, reflect it back; otherwise don't set the header
  const allowedOrigin = isAllowedOrigin(origin) ? origin : null;

  return {
    ...(allowedOrigin && { "Access-Control-Allow-Origin": allowedOrigin }),
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400", // 24 hours
  };
}

/**
 * Handle OPTIONS preflight requests
 */
export function handleCorsPreflightRequest(
  request: NextRequest
): NextResponse | null {
  if (request.method !== "OPTIONS") return null;

  const origin = request.headers.get("origin");

  if (!isAllowedOrigin(origin)) {
    return new NextResponse(null, { status: 403 });
  }

  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

/**
 * Add CORS headers to a response
 */
export function withCors(
  request: NextRequest,
  response: NextResponse
): NextResponse {
  const corsHeaders = getCorsHeaders(request);

  Object.entries(corsHeaders).forEach(([key, value]) => {
    if (value) response.headers.set(key, value);
  });

  return response;
}
