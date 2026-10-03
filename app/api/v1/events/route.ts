import { NextResponse } from "next/server";
import { getProximosEventos } from "@/lib/eventos";

/**
 * Los límites que declara el OpenAPI, en un sitio solo.
 *
 * Estaban escritos en la línea del `parseInt`, con lo que leerlos era leer una
 * expresión aritmética y no un contrato. El `default: 50` del documento, el
 * `minimum: 1` y el `maximum: 200` son tres números que tenían que coincidir con
 * tres números de aquí, y nada lo comprobaba.
 */
const LIMIT_POR_DEFECTO = 50;
const LIMIT_MINIMO = 1;
const LIMIT_MAXIMO = 200;

/**
 * Un entero de la query, o el valor por defecto si no es un entero.
 *
 * **Por qué `parseInt` no servía.** `parseInt("all")` es `NaN`, y el `Math.min`/
 * `Math.max` que lo recortaba también lo es: `NaN` se propaga en vez de quedarse
 * fuera del rango. De ahí salía la página vacía más silenciosa del repo. Con
 * `?limit=all` —que es como el cliente móvil pide "dame todo"— la respuesta era
 *
 *     {data: [], meta: {total: 120, limit: null, offset: 0, hasMore: false}}
 *
 * por tres motivos encadenados: `slice(0, NaN)` es `slice(0, 0)`, o sea cero
 * eventos; `JSON.stringify` convierte `NaN` en `null`, así que el móvil recibía
 * `limit: null` en vez de un número; y `hasMore: false` le decía que no había
 * nada más, con lo que **dejaba de paginar en la primera página sin haber visto
 * un evento ni un error**. Un `200` con `data: []` y `hasMore: false` no es
 * distinguible de "de verdad no hay eventos".
 *
 * **Por qué la diferencia entre caer al default y recortar.** Un valor que no es
 * un número no es una petición, es una sorpresa: el cliente no sabe pedir y lo
 * adecuado es darle el comportamiento documentado (50). Un valor numérico fuera de
 * rango sí es una petición, solo que exagerada: quien manda `limit=1000` quiere
 * "mucho", y 200 recortados le sirven; devolverle 50 le obligaría a paginar veinte
 * veces por lo mismo. Ninguno de los dos casos es un error que merezca un 400,
 * porque el endpoint responde igual y bien en los dos: no hay nada que el cliente
 * pueda corregir.
 *
 * `Number` y no `parseInt` a propósito. `parseInt("100abc")` da 100, así que una
 * basura con un número delante pasaba por una petición válida; `Number("100abc")`
 * es `NaN` y cae al default, que es lo que corresponde a algo que no es un entero.
 * El `""` se trata aparte porque `Number("")` es `0`, y un `?limit=` vacío tiene
 * que ser el default y no el mínimo.
 */
function enteroDe(
  searchParams: URLSearchParams,
  clave: string,
  porDefecto: number,
  min: number,
  max: number
): number {
  const bruto = searchParams.get(clave);
  if (bruto === null || bruto.trim() === "") return porDefecto;

  const n = Number(bruto);
  if (!Number.isFinite(n)) return porDefecto;

  // `Math.trunc` porque `?limit=2.7` es una petición válida con un entero
  // debajo, y `slice` no acepta decimales. Con `NaN` ya descartado, `trunc` solo
  // puede sacar la parte entera, no cambiarla de signo.
  return Math.min(Math.max(Math.trunc(n), min), max);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const startDate =
    searchParams.get("startDate") || searchParams.get("date") || undefined;
  const endDate = searchParams.get("endDate") || undefined;
  const category = searchParams.get("category")?.toLowerCase() || undefined;
  const source = searchParams.get("source")?.toLowerCase() || undefined;
  const search = searchParams.get("search")?.toLowerCase() || undefined;
  const limit = enteroDe(
    searchParams,
    "limit",
    LIMIT_POR_DEFECTO,
    LIMIT_MINIMO,
    LIMIT_MAXIMO
  );
  // `offset` no lleva máximo a propósito: no hay tope documentado para él y
  // recortarlo dejaría al cliente en un bucle infinito de páginas vacías al
  // final de un listado largo. Lo que no puede ser es `NaN`, que devolvía `[]`.
  const offset = enteroDe(searchParams, "offset", 0, 0, Number.MAX_SAFE_INTEGER);

  try {
    let eventos = await getProximosEventos({ startDate, endDate });

    if (category) {
      eventos = eventos.filter(
        (e) => e.category?.toLowerCase().includes(category)
      );
    }

    if (source) {
      eventos = eventos.filter(
        (e) => e.source?.toLowerCase() === source
      );
    }

    if (search) {
      eventos = eventos.filter(
        (e) =>
          e.title?.toLowerCase().includes(search) ||
          e.location?.toLowerCase().includes(search) ||
          e.description?.toLowerCase().includes(search)
      );
    }

    const total = eventos.length;
    const paginated = eventos.slice(offset, offset + limit);

    return NextResponse.json({
      data: paginated,
      meta: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("Error en /api/v1/events:", error);
    return NextResponse.json(
      { error: "Error al obtener eventos" },
      { status: 500 }
    );
  }
}
