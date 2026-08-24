import { NextRequest, NextResponse } from "next/server";
import { addSubscription, removeSubscription } from "@/lib/push";

function isValidSubscription(body: unknown): body is {
  endpoint: string;
  keys: { p256dh: string; auth: string };
} {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  const keys = b.keys as Record<string, unknown> | undefined;
  return (
    typeof b.endpoint === "string" &&
    b.endpoint.startsWith("https://") &&
    typeof keys?.p256dh === "string" &&
    typeof keys?.auth === "string"
  );
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!isValidSubscription(body)) {
    return NextResponse.json(
      { error: "Suscripción inválida" },
      { status: 400 }
    );
  }

  await addSubscription({
    endpoint: body.endpoint,
    keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
    addedAt: Date.now(),
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const endpoint =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>).endpoint
      : undefined;

  if (typeof endpoint !== "string") {
    return NextResponse.json(
      { error: "Falta endpoint" },
      { status: 400 }
    );
  }

  await removeSubscription(endpoint);
  return NextResponse.json({ ok: true });
}
