import { NextResponse } from "next/server";
import { scrapeFarmacias } from "@/lib/sources/farmacias";

export async function GET() {
  try {
    const farmacias = await scrapeFarmacias();
    return NextResponse.json({
      source: "cofalava",
      date: farmacias[0]?.date || "",
      count: farmacias.length,
      fetchedAt: Date.now(),
      data: farmacias,
    });
  } catch (error) {
    console.error("Error scraping farmacias de guardia:", error);
    return NextResponse.json(
      { error: "No se pudieron obtener las farmacias de guardia" },
      { status: 500 }
    );
  }
}
