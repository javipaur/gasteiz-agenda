import { NextResponse } from "next/server";
import { scrapeMunicipalCalendar } from "@/lib/sources/municipal";

/**
 * Agenda municipal (`tipo: 6`). Es la misma consulta que hace la entrada
 * `municipal-agenda` del registro, así que el resultado es el mismo evento a
 * evento a evento con el mismo `source`; lo único que añade esta ruta es la forma
 * que espera un cliente externo.
 *
 * Se deja con su propio fetch y no como vista del agregado a propósito: el
 * agregado deduplica por título+fecha y devuelve `AgendaEvento`, y un consumidor
 * que hoy recibe `MunicipialEvento` vería campos que no están en su contrato.
 */
export async function GET() {
  try {
    const eventos = await scrapeMunicipalCalendar({ tipo: [6] });
    return NextResponse.json(eventos);
  } catch (error) {
    return NextResponse.json(
      { error: "Error al consultar eventos" },
      { status: 500 }
    );
  }
}