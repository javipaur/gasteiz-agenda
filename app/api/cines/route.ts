import { NextResponse } from "next/server";
import { getPeliculas, type PeliculaConCine } from "@/lib/cines";

export const runtime = "nodejs";
export const revalidate = 3600;

export async function GET() {
  try {
    const peliculas: PeliculaConCine[] = await getPeliculas();
    return NextResponse.json({
      url: "https://www.reservaentradas.com/cine/alava/florida",
      scrapedAt: new Date().toISOString(),
      total: peliculas.length,
      peliculas,
    });
  } catch (error) {
    console.error("Error al obtener datos de los cines:", error);
    return NextResponse.json({ peliculas: [] }, { status: 200 });
  }
}