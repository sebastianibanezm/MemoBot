# Security Implementation Plan: CORS & Rate Limiting

## Overview
This plan implements two high-priority security improvements for MemoBot:
1. **Restrict CORS origins** - Prevent cross-origin attacks
2. **Add rate limiting** - Prevent API abuse and DoS attacks

---

## Task 1: Restrict CORS Origins

### Problem
Current `apps/web/vercel.json` allows all origins with `"Access-Control-Allow-Origin": "*"`, which permits any website to make requests to your API.

### Solution
Implement environment-aware CORS that only allows your production domain and localhost for development.

### Step 1.1: Update `apps/web/vercel.json`

Replace the current CORS headers section:

```json
{
  "framework": "nextjs",
  "regions": ["iad1"],
  "headers": [
    {
      "source": "/api/webhook/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "POST, OPTIONS" },
        { "key": "Access-Control-Allow-Headers", "value": "Content-Type, X-Telegram-Bot-Api-Secret-Token, X-Hub-Signature-256" }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/api/webhook/:path*",
      "destination": "/api/webhook/:path*"
    }
  ],
  "crons": [
    {
      "path": "/api/cron/reminders",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

**Note:** Webhooks need `*` because Telegram/WhatsApp servers send requests from their domains. All other API routes will use dynamic CORS via middleware.

### Step 1.2: Create CORS utility

Create new file `apps/web/src/lib/cors.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";

/**
 * Allowed origins for CORS. Add your production domain here.
 */
const ALLOWED_ORIGINS = [
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
export function handleCorsPreflightRequest(request: NextRequest): NextResponse | null {
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
export function withCors(request: NextRequest, response: NextResponse): NextResponse {
  const corsHeaders = getCorsHeaders(request);
  
  Object.entries(corsHeaders).forEach(([key, value]) => {
    if (value) response.headers.set(key, value);
  });
  
  return response;
}
```

### Step 1.3: Update middleware to handle CORS

Update `apps/web/src/middleware.ts`:

```typescript
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/health",
  "/api/webhook(.*)",
  "/api/auth/(.*)/callback",
]);

// Routes that need CORS (API routes except webhooks which have their own CORS)
const isApiRoute = createRouteMatcher(["/api/((?!webhook).*)"]); 

// Allowed origins
const ALLOWED_ORIGINS = [
  "https://memo-bot.com",
  "https://www.memo-bot.com",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true; // Same-origin requests don't have Origin header
  // Allow Vercel preview deployments
  if (/^https:\/\/memobot-.*\.vercel\.app$/.test(origin)) return true;
  return ALLOWED_ORIGINS.includes(origin);
}

function corsHeaders(origin: string | null): HeadersInit {
  const allowedOrigin = origin && isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export default clerkMiddleware(async (auth, request: NextRequest) => {
  const origin = request.headers.get("origin");
  
  // Handle CORS preflight for API routes
  if (isApiRoute(request) && request.method === "OPTIONS") {
    if (!isAllowedOrigin(origin)) {
      return new NextResponse(null, { status: 403 });
    }
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }
  
  // Block requests from disallowed origins on API routes
  if (isApiRoute(request) && origin && !isAllowedOrigin(origin)) {
    return new NextResponse(JSON.stringify({ error: "Origin not allowed" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Protect non-public routes
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
  
  // Add CORS headers to API responses
  const response = NextResponse.next();
  if (isApiRoute(request)) {
    Object.entries(corsHeaders(origin)).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }
  
  return response;
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ico|woff2?|map)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

### Step 1.4: Add environment variable for allowed origins (optional but recommended)

Add to `apps/web/.env.local`:

```env
# Comma-separated list of allowed CORS origins (optional override)
ALLOWED_ORIGINS=https://memo-bot.com,https://www.memo-bot.com
```

---

## Task 2: Add Rate Limiting

### Problem
No rate limiting exists, allowing potential API abuse, brute force attacks, or DoS.

### Solution
Implement rate limiting using Upstash Redis (serverless, works with Vercel Edge) with fallback to in-memory for development.

### Step 2.1: Install dependencies

```bash
cd apps/web
npm install @upstash/ratelimit @upstash/redis
```

### Step 2.2: Set up Upstash Redis

1. Go to https://console.upstash.com/
2. Create a new Redis database (free tier works)
3. Copy the REST URL and token to your environment variables

Add to `apps/web/.env.local`:

```env
# Upstash Redis for rate limiting
UPSTASH_REDIS_REST_URL=https://your-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here
```

### Step 2.3: Create rate limiter utility

Create new file `apps/web/src/lib/rate-limit.ts`:

```typescript
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

type RateLimitType = keyof typeof RATE_LIMITS;

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
```

### Step 2.4: Create rate limit middleware helper

Create new file `apps/web/src/lib/api-utils.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  checkRateLimit,
  getRateLimitIdentifier,
  rateLimitHeaders,
  RATE_LIMITS,
} from "./rate-limit";

type RateLimitType = keyof typeof RATE_LIMITS;

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
      return new NextResponse(
        JSON.stringify({
          error: "Too many requests",
          message: "Please slow down and try again later",
          retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000),
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": Math.ceil((rateLimitResult.reset - Date.now()) / 1000).toString(),
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
```

### Step 2.5: Apply rate limiting to API routes

#### Example: Update `apps/web/src/app/api/chat/route.ts`

```typescript
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { withRateLimit } from "@/lib/api-utils";
// ... other imports

async function handlePost(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  // ... rest of your existing handler code
}

// Export with rate limiting (20 req/min for chat)
export const POST = withRateLimit(handlePost, { type: "chat" });
```

#### Example: Update `apps/web/src/app/api/link-code/route.ts`

```typescript
import { withRateLimit } from "@/lib/api-utils";
// ... other imports

async function handlePost(request: NextRequest) {
  // ... existing code
}

// Export with stricter rate limiting for auth-related endpoint
export const POST = withRateLimit(handlePost, { type: "auth" });
```

### Step 2.6: Routes to update with rate limiting

Apply `withRateLimit` to these routes:

| Route | File | Rate Limit Type |
|-------|------|----------------|
| `/api/chat` | `src/app/api/chat/route.ts` | `chat` |
| `/api/link-code` | `src/app/api/link-code/route.ts` | `auth` |
| `/api/linked-accounts` | `src/app/api/linked-accounts/route.ts` | `api` |
| `/api/sync/process` | `src/app/api/sync/process/route.ts` | `memory` |

**Note:** Don't add rate limiting to:
- `/api/health` - Needs to always respond for monitoring
- `/api/webhook/*` - External services need higher limits, handled separately
- `/api/auth/*/callback` - OAuth callbacks from external providers

---

## Testing

### Test CORS

```bash
# Should succeed (allowed origin)
curl -H "Origin: http://localhost:3000" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     http://localhost:3000/api/chat

# Should fail with 403 (disallowed origin)
curl -H "Origin: https://evil-site.com" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     http://localhost:3000/api/chat
```

### Test Rate Limiting

```bash
# Hit the endpoint many times quickly
for i in {1..70}; do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/health
done

# Should see 429 responses after hitting the limit
```

---

## Environment Variables Summary

Add these to `apps/web/.env.local` and Vercel:

```env
# Rate Limiting (Upstash Redis)
UPSTASH_REDIS_REST_URL=https://your-url.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here

# CORS (optional - defaults are hardcoded)
ALLOWED_ORIGINS=https://memo-bot.com,https://www.memo-bot.com
```

---

## Verification Checklist

- [ ] CORS: Requests from `localhost:3000` work in development
- [ ] CORS: Requests from `memo-bot.com` work in production
- [ ] CORS: Requests from random origins are blocked with 403
- [ ] CORS: Webhook endpoints still accept requests from Telegram/WhatsApp
- [ ] Rate Limit: API returns `X-RateLimit-*` headers
- [ ] Rate Limit: Excessive requests return 429 with `Retry-After` header
- [ ] Rate Limit: Authenticated users are rate limited by userId
- [ ] Rate Limit: Unauthenticated requests are rate limited by IP
- [ ] All existing tests still pass (`npm run test` from `apps/web`)

---

## Rollback Plan

If issues arise:

1. **CORS**: Revert `vercel.json` to allow `*` temporarily
2. **Rate Limiting**: Remove `withRateLimit` wrapper from affected routes
3. **Both**: The changes are additive and can be reverted by reverting the specific files