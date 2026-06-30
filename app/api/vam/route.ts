import { NextResponse } from "next/server";
import { scrapeVamEvents } from "@/lib/sources/vam";

export async function GET() {
  try {
    const events = await scrapeVamEvents();
    return NextResponse.json({
      source: "vam",
      count: events.length,
      data: events,
    });
  } catch (error) {
    console.error("Error scraping VAM:", error);
    return NextResponse.json(
      { error: "No se pudieron obtener eventos de VAM" },
      { status: 500 }
    );
  }
}
