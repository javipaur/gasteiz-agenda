import { NextResponse } from "next/server";

import { scrapeMunicipalCalendar } from "@/lib/sources/municipal";

/**
 * Calendario municipal sin filtro, que es `calendariosID=196`: exactamente lo que
 * pregunta la entrada `municipal-general` del registro.
 *
 * Antes esta ruta montaba su propia consulta a `CalendarioServlet` y traía
 * copiadas de `lib/sources/municipal.ts` las tres piezas que la hacen —el regex
 * del `srcset`, la transformación del sufijo `_smart` y el aplanado de las
 * secciones de la respuesta—, con el cuerpo además indentado de forma irregular.
 * Ahora pide el mismo dato al scraper y decide aquí solo la forma.
 *
 * La forma no cambia porque la consume un cliente externo: mismos cinco campos,
 * con `""` en los que quedan vacíos y `null` en la imagen. Lo único que cambia es
 * que dos de esos campos ya no pueden salir vacíos donde antes sí:
 * `scrapeMunicipalCalendar` cae a `fechaInicio` si no hay `datetime` y a
 * `dirUbicacion` si no hay `localizacion`. Es más dato, no menos, y solo cuando el
 * calendario lacks del campo principal.
 */
export async function GET() {
  try {
    const eventos = (await scrapeMunicipalCalendar()).map((evento) => ({
      title: evento.title,
      date: evento.date,
      image: evento.image ?? null,
      location: evento.location,
      link: evento.link,
    }));

    return NextResponse.json(eventos);
  } catch (error) {
    return NextResponse.json(
      { error: "Error al consultar eventos" },
      { status: 500 }
    );
  }
}