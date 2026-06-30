import { NextResponse } from "next/server";
import { scrapeVamConciertos } from "@/lib/sources/vam";

export async function GET() {
  try {
    const events = await scrapeVamConciertos();
    return NextResponse.json(events);
  } catch (error) {
    console.error("Error scraping VAM conciertos:", error);
    return NextResponse.json(
      { error: "No se pudieron obtener eventos de VAM" },
      { status: 500 }
    );
  }
}
