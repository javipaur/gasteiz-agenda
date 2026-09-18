import { NextResponse } from "next/server";
import { logger } from "@/lib/axiom/server";
import { createProxyRouteHandler } from "@axiomhq/nextjs";

const proxy = createProxyRouteHandler(logger);

export async function POST(req: Request) {
  return proxy(req);
}

export async function GET() {
  return NextResponse.json({ ok: true });
}