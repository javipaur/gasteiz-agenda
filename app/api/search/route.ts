import { NextResponse } from "next/server";
import { buscarAgenda } from "@/lib/buscar";

export const dynamic = "force-dynamic";

/**
 * La búsqueda vive en `lib/buscar.ts` y esta ruta es una capa fina, porque la
 * página `/buscar` necesita exactamente la misma lógica y dos copias de un filtro
 * de texto son dos reglas que divergen sin que nada avise.
 *
 * El cambio de comportamiento que importa es otro: antes esta ruta recortaba a 6 y
 * no devolvía el total, así que el desplegable de la cabecera —que hacía
 * `slice(0, 7)` encima— no podía ver nunca más de seis, y su enlace "Ver todos los
 * resultados" iba a `/culture?q=`, que solo conoce 9 de las 28 fuentes. Seis
 * resultados y luego una página vacía.
 */
export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;

    const { results, total } = await buscarAgenda(params.get("q") || "", {
      limit: Number(params.get("limit")),
      offset: Number(params.get("offset")),
    });
    return NextResponse.json({ results, total });
  } catch (error) {
    // **Un fallo ya no se disfraza de "no hay resultados".** Este `catch` devolvía
    // `{results: []}` con status 200 y sin mirar siquiera el error, y eso es
    // byte a byte lo mismo que la respuesta de una búsqueda que no encuentra
    // nada. El buscador de la cabecera —y el del móvil— pintaba "sin resultados" y
    // se paraba ahí, sin un status ni un log que dijera que el índice no se pudo
    // leer.
    //
    // 503 y no 500 a propósito: no es un error de este endpoint, es que la agenda
    // no estaba disponible en este momento, y el 503 es el código que un cliente
    // (o un proxy delante) sabe que puede reintentar. Es el mismo razonamiento que
    // el de los cines con 502, con 500 en el medio.
    //
    // Lo de dentro es raro pero no imposible: `getAgendaEventos` no lanza casi
    // nunca porque `aggregate` usa `allSettled`, pero la capa de caché de disco
    // sí lee y escribe ficheros, y un `JSON.parse` o un `stat` que fallara fuera de
    // su `try` se colaba hasta aquí.
    console.error("Error en /api/search:", error);
    return NextResponse.json(
      { error: "No se pudo buscar en la agenda" },
      { status: 503 }
    );
  }
}
