import { NextResponse } from "next/server";
import { getSitios, getRutasPintxos } from "@/lib/gastronomia";

/**
 * Dónde comer en Vitoria-Gasteiz, para la web y para la app móvil.
 *
 * ## Por qué existe esta ruta
 *
 * La página `/gastronomia` lee los dos catálogos **en el servidor**, así que la
 * web los ve sin necesitar nada más. La app móvil no puede: es un cliente
 * externo, no comparte proceso con el servidor y no tiene los JSON curados en
 * su bundle. Sin una ruta, la app tenía que inventarse sus propios sitios, y
 * entonces la web y la app dirían dos cosas distintas sobre la misma ciudad.
 *
 * ## Qué devuelve, y por qué en dos listas
 *
 * `data` son los sitios y `rutas` las rutas de pintxos, en el mismo envelope
 * que el resto de rutas públicas (`source`, `count`, `fetchedAt`, `data`). Van
 * separadas y no mezcladas porque son dos cosas distintas: un sitio tiene
 * dirección y precio, y una ruta tiene paradas, duración y un consejo. Meterlas
 * en el mismo array obligaría a cada cliente a adivinar cuál es cuál por la
 * forma de los campos, que es como se rompe un cliente sin que falle nada.
 *
 * `count` cuenta los sitios, que es lo que mira quien depura "¿llegaron todos?".
 * Las rutas son seis y fijas, así que su número no dice nada que no diga el
 * array.
 *
 * ## Los datos son curados, no raspados
 *
 * Salen de `data/gastronomia/*.json`, que es una lista que se mantiene a mano.
 * `source: "curado"` lo dice: no hay un sitio detrás del que tirar, y por eso
 * esta ruta no puede fallar por una fuente caída. Solo puede fallar si el JSON
 * no está, y entonces el error se propaga en vez de devolver una lista vacía
 * —"no hay restaurantes en Vitoria" y "no se pudo leer el catálogo" se ven
 * igual, y son cosas opuestas—.
 */
export async function GET() {
  try {
    const [sitios, rutas] = await Promise.all([getSitios(), getRutasPintxos()]);

    return NextResponse.json({
      source: "curado",
      count: sitios.length,
      fetchedAt: Date.now(),
      data: sitios,
      rutas,
    });
  } catch (error) {
    console.error("Error leyendo el catálogo de gastronomía:", error);
    return NextResponse.json(
      { error: "No se pudo leer el catálogo de gastronomía" },
      { status: 502 }
    );
  }
}
