import { NextRequest, NextResponse } from "next/server";
import { sendToAll, type PushPayload } from "@/lib/push";
import { buildDailyDigest } from "@/lib/digest";

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const hasCustom =
    typeof body.title === "string" && typeof body.body === "string";

  let payload: PushPayload;
  try {
    if (hasCustom) {
      payload = {
        title: (body.title as string).slice(0, 120),
        body: (body.body as string).slice(0, 300),
        url: typeof body.url === "string" ? body.url : "/",
      };
    } else {
      payload = await buildDailyDigest();
    }

    const result = await sendToAll(payload);
    return NextResponse.json({ ok: true, payload, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error enviando push" },
      { status: 500 }
    );
  }
}
