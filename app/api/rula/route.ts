import { NextResponse } from "next/server";
import { scrapeRula } from "@/lib/sources/rula";

export async function GET() {
  try {
    const events = await scrapeRula();
    return NextResponse.json({
      source: "lagenterula",
      count: events.length,
      data: events,
    });
  } catch (error) {
    console.error("Error scraping lagenterula:", error);
    return NextResponse.json(
      { error: "Error al consultar eventos de La Gente Rula" },
      { status: 500 }
    );
  }
}
