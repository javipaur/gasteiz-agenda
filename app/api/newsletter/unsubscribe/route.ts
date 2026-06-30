import { NextResponse } from "next/server";
import { removeSubscriber } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token requerido" }, { status: 400 });
  }

  const removed = removeSubscriber(token);

  return NextResponse.redirect(
    new URL(
      removed ? "/?newsletter=unsubscribed" : "/?newsletter=error",
      req.url
    )
  );
}
