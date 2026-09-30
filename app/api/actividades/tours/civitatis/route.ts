import { NextResponse } from "next/server";
import { scrapeCivitatisTours } from "@/lib/sources/civitatis";

export const revalidate = 3600;

export async function GET() {
  try {
    const tours = await scrapeCivitatisTours();

    return NextResponse.json({
      source: "civitatis",
      category: "tours",
      count: tours.length,
      data: tours,
    });
  } catch (error) {
    console.error("Error obteniendo los tours de Civitatis:", error);
    return NextResponse.json(
      { error: "No se pudieron obtener los tours" },
      { status: 500 }
    );
  }
}
