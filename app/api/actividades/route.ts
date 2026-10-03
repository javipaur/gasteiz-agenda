import { NextResponse } from "next/server";

import { scrapeMunicipalCalendar } from "@/lib/sources/municipal";
import { agendaSlug } from "@/lib/slug";

/**
 * Actividades del calendario general del Ayuntamiento (`calendariosID=196`).
 *
 * **El bug que arregla: esta ruta devolvía siempre lista vacía.** Leía
 * `data.resultados`, y `CalendarioServlet?accion=buscar` no tiene esa clave: su
 * respuesta es una bolsa de secciones —en el fixture, `exposiciones`, `filtros`,
 * `actividades` y `vista`— y los eventos viven dentro de cada una, en
 * `seccion.resultados`. Por eso `lib/sources/municipal.ts` aplana con
 * `Object.values(data).reduce(...)`: es el aplanado, no un detalle.
 *
 * El síntoma era el peor que puede darse, porque no delataba nada: `(data?.resultados
 * || [])` convertía "no sé dónde está el dato" en "no hay actividades", así que
 * la respuesta era `200 {count: 0, data: []}` para siempre, sin excepción, sin
 * status raro y **sin un solo log**. Leer una clave que no existe no lanza
 * nunca, que es exactamente lo que hace que un fallo así sobreviva meses.
 *
 * Ahora pide el dato al scraper, que es la única puerta al calendario —esto es lo
 * mismo que hizo `d09f311` en `app/api/actividades/eventos/agenda/route.ts`, y por
 * qué aquí no se repite el aplanado ni se escribe un cuarto fetch a mano— y decide
 * solo la forma.
 *
 * **La forma no se toca**: cuatro claves de fuera y nueve campos por evento, los
 * mismos. `tipo` y `dest` se quedan en el envelope aunque salgan a `null`, porque
 * están en el contrato y `MunicipialEvento` no los expone: en la respuesta cruda
 * `tipo` viene por evento pero siempre a `null` en lo que se ha visto, y `dest` no
 * existe como campo, sino que es un filtro de la consulta (así lo usa el registro:
 * `scrapeMunicipalCalendar({ tipo: [6] })` y `({ dest: ["infantil"] })`). Ninguna de
 * las dos rutas pasa ese filtro, así que las dos piden el calendario entero.
 *
 * El `id` tampoco se genera aquí, y ese es el segundo bug de la ruta. Antes caía a
 * `crypto.randomUUID()`, con lo que dos peticiones del mismo evento devolvían dos
 * ids distintos: nada que deduplicar entre recargas y ningún favorito que
 * sobreviva a un refresco. Y mudarlo al scraper no arreglaba nada, porque
 * `normalizeEvento` de `municipal.ts` también cae a `crypto.randomUUID()` cuando
 * el Ayuntamiento no manda `codigo` —que es lo que pasa en todas las actividades
 * que se han visto—. Así que el id sale de `agendaSlug`, que es la puerta que el
 * propio repo marca para un evento crudo: el mismo que usa `normalizeRaw` para el
 * agregado, con el mismo trim y el mismo tratamiento del `"#"`, de modo que un
 * evento de aquí y el mismo de la agenda tienen el mismo identificador.
 */
export async function GET() {
  try {
    const eventos = await scrapeMunicipalCalendar({ calendariosID: 196 });

    return NextResponse.json({
      source: "vitoria-gasteiz",
      category: "eventos",
      count: eventos.length,
      data: eventos.map((evento) => ({
        id: agendaSlug(evento),
        title: evento.title,
        description: evento.description ?? "",
        date: evento.date,
        image: evento.image ?? null,
        link: evento.link,
        category: "eventos",
        source: "vitoria-gasteiz",
        tipo: null,
        dest: null,
      })),
    });
  } catch (error) {
    // El texto del error no se toca: es la misma cadena que ya emitían estas dos
    // rutas, y un cliente que compare contra ella no se entera de nada.
    console.error("Error al obtener actividades:", error);
    return NextResponse.json(
      { error: "Error al consultar eventos" },
      { status: 500 }
    );
  }
}