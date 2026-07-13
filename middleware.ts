import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.API_KEY;

const PUBLIC_API_ROUTES = [
  "/api/newsletter/subscribe",
  "/api/newsletter/confirm",
  "/api/newsletter/unsubscribe",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  if (PUBLIC_API_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  if (!API_KEY) {
    console.warn("API_KEY not set – API endpoints are open");
    return NextResponse.next();
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

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
