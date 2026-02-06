import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/pricing",
  "/api/health",
  "/api/webhook(.*)",      // Includes /api/webhooks/stripe
  "/api/auth/(.*)/callback",
  "/_next/image(.*)",      // Next.js image optimization proxy
]);

// Routes that need CORS (API routes except webhooks which have their own CORS in vercel.json)
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
  // Check environment variable override
  const envOrigins = process.env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim());
  if (envOrigins?.includes(origin)) return true;
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
    "/((?!_next/|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ico|woff2?|map)).*)",
    "/(api|trpc)(.*)",
  ],
};
