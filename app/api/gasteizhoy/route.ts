import { NextResponse } from "next/server";
import { scrapeGasteizHoy } from "@/lib/sources/gasteizhoy";

export async function GET() {
  try {
    const events = await scrapeGasteizHoy();
    return NextResponse.json({
      source: "gasteizhoy",
      count: events.length,
      data: events,
    });
  } catch (error) {
    console.error("Error scraping Gasteiz Hoy:", error);
    return NextResponse.json(
      { error: "Error al consultar eventos de Gasteiz Hoy" },
      { status: 500 }
    );
  }
}
