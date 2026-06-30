import { NextResponse } from "next/server";
import { scrapeBoulevard } from "@/app/services/boulevard";

export const runtime = "nodejs";
export const revalidate = 3600;

export async function GET() {
  try {
    const peliculas = await scrapeBoulevard();
    return NextResponse.json({
      url: "https://www.sensacine.com/cines/cine/E0786/",
      scrapedAt: new Date().toISOString(),
      total: peliculas.length,
      peliculas,
    });
  } catch (error) {
    console.error("Error al obtener datos de Yelmo Cines Boulevard:", error);
    return NextResponse.json(
      { peliculas: [] },
      { status: 200 }
    );
  }
}
