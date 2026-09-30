import { NextResponse } from "next/server";
import { addSubscriber } from "@/lib/db";
import { sendConfirmationEmail } from "@/lib/email";

const MIN_FORM_TIME_MS = 3000;
const RATE_WINDOW_MS = 10 * 60_000;
const RATE_MAX_PER_EMAIL = 5;
const RATE_MAX_PER_IP = 20;
const rateAttempts = new Map<string, number[]>();

function isRateLimited(key: string, max: number): boolean {
  const now = Date.now();
  const attempts = (rateAttempts.get(key) || []).filter(
    (t) => now - t < RATE_WINDOW_MS
  );
  if (attempts.length >= max) return true;
  attempts.push(now);
  rateAttempts.set(key, attempts);
  return false;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const website = typeof body?.website === "string" ? body.website : "";
    const startedAt = body?.startedAt;

    if (website.length > 0) {
      return NextResponse.json({
        ok: true,
        message: "Suscripción registrada",
      });
    }

    if (
      typeof startedAt !== "number" ||
      Date.now() - startedAt < MIN_FORM_TIME_MS
    ) {
      return NextResponse.json({
        ok: true,
        message: "Suscripción registrada",
      });
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Email inválido" },
        { status: 400 }
      );
    }

    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    if (isRateLimited(`ip:${clientIp}`, RATE_MAX_PER_IP)) {
      return NextResponse.json(
        { error: "Demasiados intentos. Inténtalo más tarde." },
        { status: 429 }
      );
    }

    if (isRateLimited(`${clientIp}|${email.toLowerCase()}`, RATE_MAX_PER_EMAIL)) {
      return NextResponse.json(
        { error: "Demasiados intentos. Inténtalo más tarde." },
        { status: 429 }
      );
    }

    const { token, exists, active } = addSubscriber(email);

    await sendConfirmationEmail(email, token);

    // Tres casos y no dos. Con el alta directa, «ya estás suscrito» era cierto
    // siempre que el correo estaba en la lista; con la doble confirmación hay un
    // tercero —se dio de baja y vuelve a suscribirse— y ahí la frase sería
    // mentira: sigue en la lista, pero inactiva y esperando otro correo.
    return NextResponse.json({
      ok: true,
      message: !exists
        ? "Revisa tu correo para confirmar la suscripción."
        : active
          ? "Ya estás suscrito. Te hemos reenviado el email de confirmación."
          : "Te hemos reenviado el email de confirmación para volver a suscribirte.",
    });
  } catch (error) {
    console.error("Error subscribing:", error);
    return NextResponse.json(
      { error: "Error al procesar la suscripción" },
      { status: 500 }
    );
  }
}