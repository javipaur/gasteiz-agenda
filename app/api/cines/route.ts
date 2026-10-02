import { NextResponse } from "next/server";
import { CINE_SOURCES, getPeliculas } from "@/lib/cines";

export const runtime = "nodejs";
export const revalidate = 3600;

/**
 * Cartelera consolidada de los dos cines.
 *
 * **`url` ya no anuncia solo Florida.** Antes ponia la URL de Florida en las
 * tres rutas, incluso aqui, que devuelve los dos cines: el campo describia la
 * mitad de lo que venia debajo. Ahora es la lista de las dos fuentes, y por eso
 * es un array y no un string.
 *
 * **Un fallo de scraping es un 502, no un 200 con lista vacia.** Con
 * `Promise.allSettled` y un `catch` que devolvia `{peliculas: []}` con 200, un
 * scrape caido y un cine sin peliculasproducian la misma respuesta, y la app
 * movil cacheaba el vacio. Ahora:
 *
 * - los dos cines fallan -> 502, porque no hay nada que devolver;
 * - uno falla -> 200 con las peliculas del otro y `cinesConError` diciendo cual
 *   falta, que es el caso que antes salia como cartelera completa y mentia;
 * - alguno responde sin peliculas -> 200 con lista vacia, que si es un dato.
 */
export async function GET() {
  try {
    const { peliculas, fallidos } = await getPeliculas();

    if (fallidos.length === 2) {
      return NextResponse.json(
        {
          error: "No se pudo obtener la cartelera de ninguno de los cines",
          cinesConError: fallidos,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      urls: [CINE_SOURCES.Florida, CINE_SOURCES.Boulevard],
      scrapedAt: new Date().toISOString(),
      total: peliculas.length,
      peliculas,
      ...(fallidos.length > 0 ? { cinesConError: fallidos } : {}),
    });
  } catch (error) {
    console.error("Error al obtener datos de los cines:", error);
    return NextResponse.json(
      { error: "No se pudo obtener la cartelera" },
      { status: 502 }
    );
  }
}