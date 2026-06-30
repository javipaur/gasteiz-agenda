import { NextResponse } from "next/server";
import { scrapeJimmyJazz } from "@/lib/sources/conciertos";

export async function GET() {
  try {
    const events = await scrapeJimmyJazz();
    return NextResponse.json(events);
  } catch (error) {
    return NextResponse.json(
      { error: "Scraping failed", details: error },
      { status: 500 }
    );
  }
}
