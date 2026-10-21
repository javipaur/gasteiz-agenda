import { NextResponse } from "next/server";
import { getProximosEventos } from "@/lib/eventos";
import { recomendados } from "@/lib/recomendados";
import { localDateStr } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Lo que la web recomienda **hoy**, en la misma lista y con el mismo criterio.
 *
 * Existe porque la app móvil enseña la misma agenda y **no puede calcular esto
 ***: `recomendados()` funde los eventos que varias fuentes cuentan, los puntua
 * con los pesos de `lib/popularity.ts` y usa el criterio de "lo de hoy" que
 * usan la portada, `/hoy` y el post de Instagram. Todo eso es del servidor.
 *
 * **El criterio es el mismo y no una aproximacion.** Si la app calculara su
 * propia lista, la home de la app y la de la web dirian dos cosas distintas
 * sobre el mismo dia, que es justo lo que `lib/recomendados.ts` documenta que
 * no debe pasar.
 *
 * ## Por qué es publica
 *
 * **Una app móvil no puede guardar un secreto.** Una clave dentro de un APK
 * sale con un `strings`, asi que exigirla no protege nada. Y la agenda es
 * publica: la publica el Ayuntamiento. Lo que esta ruta hace es leer la caché
 * `agenda-all-v2`, que es un fichero en `tmpdir()`, asi que no dispara
 * scraping ni con mil peticiones a la vez —el trabajo ya esta hecho cuando
 * alguien carga la home—.
 *
 * ## La forma
 *
 * El envelope es el de las otras rutas de la agenda: `source`, `date`, `count`,
 * `fetchedAt` y `data`. Cada evento lleva `ranking`, que es su posicion, para
 * que el cliente no tenga que inventarla.
 */
export async function GET() {
  try {
    const ahora = Date.now();
    const hoy = localDateStr(new Date(ahora));

    const eventos = await getProximosEventos();
    const top = recomendados(eventos, {
      desde: hoy,
      hasta: hoy,
      limite: 10,
      hoy: new Date(ahora),
    });

    return NextResponse.json({
      source: "agenda",
      date: hoy,
      count: top.length,
      fetchedAt: new Date(ahora).toISOString(),
      data: top.map((e, i) => ({ ...e, ranking: i + 1 })),
    });
  } catch (error) {
    console.error("Error obteniendo los recomendados:", error);
    return NextResponse.json(
      { error: "No se pudieron obtener los recomendados" },
      { status: 500 }
    );
  }
}
