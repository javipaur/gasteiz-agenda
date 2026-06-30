import { NextResponse } from "next/server";
import { scrapeFever } from "@/lib/sources/fever";

export async function GET() {
  try {
    const events = await scrapeFever();
    return NextResponse.json({
      source: "fever",
      count: events.length,
      data: events,
    });
  } catch (error) {
    console.error("Error scraping Fever:", error);
    return NextResponse.json(
      { error: "Error al consultar eventos de Fever" },
      { status: 500 }
    );
  }
}
