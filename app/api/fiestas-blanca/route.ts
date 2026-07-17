import { NextResponse } from "next/server";
import { scrapeFiestasBlanca } from "@/lib/sources/fiestas-blanca";

export async function GET() {
  try {
    const fiestas = await scrapeFiestasBlanca();
    return NextResponse.json({
      source: "vitoria-gasteiz + gasteizhoy",
      festival: "Fiestas de la Virgen Blanca 2026",
      count: fiestas.length,
      data: fiestas,
    });
  } catch (error) {
    console.error("Error scraping Fiestas de la Blanca:", error);
    return NextResponse.json(
      { error: "No se pudieron obtener los eventos de las Fiestas de la Blanca" },
      { status: 500 }
    );
  }
}
