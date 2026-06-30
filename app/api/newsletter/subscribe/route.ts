import { NextResponse } from "next/server";
import { addSubscriber } from "@/lib/db";
import { sendConfirmationEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Email inválido" },
        { status: 400 }
      );
    }

    const { token, exists } = addSubscriber(email);

    await sendConfirmationEmail(email, token);

    return NextResponse.json({
      ok: true,
      message: exists
        ? "Ya estás suscrito. Te hemos reenviado el email de confirmación."
        : "Revisa tu correo para confirmar la suscripción.",
    });
  } catch (error) {
    console.error("Error subscribing:", error);
    return NextResponse.json(
      { error: "Error al procesar la suscripción" },
      { status: 500 }
    );
  }
}
