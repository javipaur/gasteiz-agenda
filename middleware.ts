import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.API_KEY;

const PUBLIC_API_ROUTES = [
  "/api/newsletter/subscribe",
  "/api/newsletter/confirm",
  "/api/newsletter/unsubscribe",
  "/api/push/subscribe",
];

const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 100;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function getRateLimitHeaders(key: string) {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return {
      "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
      "X-RateLimit-Remaining": String(RATE_LIMIT_MAX - 1),
      "X-RateLimit-Reset": String(Math.ceil((now + RATE_LIMIT_WINDOW) / 1000)),
    };
  }

  entry.count++;
  const remaining = Math.max(0, RATE_LIMIT_MAX - entry.count);
  return {
    "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.ceil(entry.resetAt / 1000)),
  };
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) return false;
  return entry.count >= RATE_LIMIT_MAX;
}

function cleanupRateLimit() {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}

let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 5 * 60_000;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  if (PUBLIC_API_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (!API_KEY) {
    console.warn("API_KEY not set – API endpoints are open");
    const response = NextResponse.next();
    setCacheHeaders(response, pathname);
    return response;
  }

  const key =
    request.headers.get("x-api-key") ??
    request.nextUrl.searchParams.get("api_key");

  if (!key || key !== API_KEY) {
    return NextResponse.json(
      {
        error:
          "Unauthorized – provide a valid x-api-key header or ?api_key= query param",
      },
      { status: 401 }
    );
  }

  const now = Date.now();
  if (now - lastCleanup > CLEANUP_INTERVAL) {
    cleanupRateLimit();
    lastCleanup = now;
  }

  if (isRateLimited(clientIp)) {
    const entry = rateLimitMap.get(clientIp)!;
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          ...getRateLimitHeaders(clientIp),
        },
      }
    );
  }

  const response = NextResponse.next();
  const rateLimitHeaders = getRateLimitHeaders(clientIp);
  for (const [k, v] of Object.entries(rateLimitHeaders)) {
    response.headers.set(k, v);
  }
  setCacheHeaders(response, pathname);
  return response;
}

function setCacheHeaders(response: NextResponse, pathname: string) {
  if (pathname.startsWith("/api/v1/")) {
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600"
    );
  } else if (pathname.startsWith("/api/cines/")) {
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=7200"
    );
  } else {
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600"
    );
  }
}

export const config = {
  matcher: "/api/:path*",
};
