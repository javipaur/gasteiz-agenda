import { NextResponse } from "next/server";
import { scrapeBuscametasInscripciones } from "@/lib/sources/buscametas";

export async function GET() {
  try {
    const eventos = await scrapeBuscametasInscripciones();
    return NextResponse.json({ eventos });
  } catch (error) {
    console.error("Error scraping inscripciones:", error);
    return NextResponse.json(
      { error: "No se pudieron obtener los eventos" },
      { status: 500 }
    );
  }
}
