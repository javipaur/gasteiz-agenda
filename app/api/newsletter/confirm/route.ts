import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(
      new URL("/?newsletter=error", req.url)
    );
  }

  // The subscriber is already active (added in subscribe), so we just redirect
  return NextResponse.redirect(
    new URL("/?newsletter=confirmed", req.url)
  );
}
