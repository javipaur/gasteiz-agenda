import { NextResponse } from "next/server";
import { getAgendaSalud } from "@/lib/agenda";
import { SOURCE_DATA } from "@/lib/source-data";

export const dynamic = "force-dynamic";

/**
 * Si el agregado que se está sirviendo está completo.
 *
 * Existe porque `aggregate` usa `Promise.allSettled`: si 13 de 28 scrapers caen, lo
 * único que sale es un `logger.warn` y la agenda se sirve más corta con HTTP 200. Quien
 * la consume —una persona o un motor de búsqueda— no tiene forma de distinguir "hoy
 * hay 400 eventos" de "hoy solo han respondido 13 fuentes". Un cliente de IA contestaría
 * con la mitad de la agenda y con toda la confianza.
 *
 * Por eso va en su propia ruta y no como una clave más de `meta` en
 * `/api/v1/events`: el `meta` de esa ruta tiene la forma fijada por la app móvil, y
 * `__tests__/api/v1-events-paginacion.test.ts` la compara con `toEqual` para que no
 * crezca sin que nadie lo decida. Y porque preguntar "¿están las 28?" tiene que poder
 * ser una llamada por su cuenta, no algo que haya que pedir en cada página de datos.
 *
 * Es pública a propósito, y no es una excepción generosa: lee la caché `agenda-all-v2`,
 * que es un fichero en `tmpdir()`, así que no dispara scraping ni con thousand requests
 * a la vez. Y no puede usarse para DoS porque no hace trabajo: el trabajo ya está hecho
 * cuando alguien carga la home.
 */
export async function GET() {
  try {
    const meta = await getAgendaSalud();

    return NextResponse.json({
      data: {
        ...meta,
        completa: meta.sourcesFallidas.length === 0,
      // El id de cada fuente, para que un cliente pueda decir "no tengo eventos de
        // Jimmy Jazz" y seguir siendo preciso: no tener eventos y no haber preguntado
        // a Jimmy Jazz son dos cosas distintas.

        fuentes: SOURCE_DATA.map((e) => ({
          id: e.id,
          label: e.label,
          group: e.group ?? e.id,
        })),
      },
    });
  } catch (error) {
    // 503 y no 500, por lo mismo que en `/api/search`: si la agenda no está
    // disponible, un 503 es el código que un cliente sabe reintentar. Y 500 con
    // `completa: false` sería peor que no responder, porque un cliente que lo lea
    // como "no hay datos" concluiría que la agenda está vacía.
    console.error("Error en /api/v1/salud:", error);
    return NextResponse.json(
      { error: "No se pudo comprobar el estado de la agenda" },
      { status: 503 }
    );
  }
}
