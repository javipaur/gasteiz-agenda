import { NextResponse } from "next/server";
import { scrapeBoulevard } from "@/app/services/boulevard";
import { CINE_SOURCES } from "@/lib/cines";

export const runtime = "nodejs";
export const revalidate = 3600;

/**
 * Cartelera de Yelmo Cines Boulevard.
 *
 * Mismo contrato que Florida: 502 si la fuente falla, 200 con `peliculas: []`
 * si el cine no tiene nada. Antes devolvia 200 con la lista vacia tambien en el
 * primer caso, que era indistinguible y ademas se cacheaba en el cliente.
 *
 * `duracion` sale vacia en todas las peliculas porque Sensacine no la publica
 * en la pagina del cine; el detalle esta en `app/services/boulevard.ts`.
 */
export async function GET() {
  try {
    const peliculas = await scrapeBoulevard();
    return NextResponse.json({
      url: CINE_SOURCES.Boulevard,
      scrapedAt: new Date().toISOString(),
      total: peliculas.length,
      peliculas,
    });
  } catch (error) {
    console.error("Error al obtener datos de Yelmo Cines Boulevard:", error);
    return NextResponse.json(
      { error: "No se pudo obtener la cartelera de Cines Boulevard" },
      { status: 502 }
    );
  }
}