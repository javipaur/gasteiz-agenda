import { NextResponse } from "next/server";
import { scrapeFlorida } from "@/lib/sources/cines";
import { CINE_SOURCES } from "@/lib/cines";

export const runtime = "nodejs";
export const revalidate = 3600;

/**
 * Cartelera de Cine Florida.
 *
 * El `catch` devuelve 502 en vez de `{peliculas: []}` con 200: un fallo de la
 * fuente no es lo mismo que no tener peliculas, y con 200 el cliente no podia
 * distinguirlo. `scrapeFlorida` propaga el error, asi que este `catch` lo ve.
 */
export async function GET() {
  try {
    const peliculas = await scrapeFlorida();
    return NextResponse.json({
      url: CINE_SOURCES.Florida,
      scrapedAt: new Date().toISOString(),
      total: peliculas.length,
      peliculas,
    });
  } catch (error) {
    console.error("Error al obtener datos de Cine Florida:", error);
    return NextResponse.json(
      { error: "No se pudo obtener la cartelera de Cine Florida" },
      { status: 502 }
    );
  }
}