import { NextResponse } from "next/server";

import { scrapeMunicipalCalendar } from "@/lib/sources/municipal";
import { agendaSlug } from "@/lib/slug";

/**
 * Eventos de Navidad: el calendario `calendariosID=566` del Ayuntamiento.
 *
 * **El mismo bug que `/api/actividades`, y por el mismo motivo.** Las dos rutas
 * eran copias de una consulta a `CalendarioServlet` que leía `data.resultados`,
 * y esa clave no existe: la respuesta es una bolsa de secciones (`exposiciones`,
 * `filtros`, `actividades`, `vista`) y los eventos están en `seccion.resultados`,
 * que es justo lo que `fetchMunicipalCalendar` aplana con `Object.values(data)`.
 * El `|| []` convertía "no sé dónde está" en "no hay nada", y el resultado era un
 * `200 {count: 0, data: []}` permanente sin error ni log.
 *
 * Que las dos rutas estuvieran rotas a la vez no es casualidad: al copiar la
 * consulta una a otra se copió también el error. Arreglarlas las dos contra
 * `scrapeMunicipalCalendar` deja de existir el sitio donde volver a copiarlo.
 *
 * `calendariosID=566` es lo único específico de Navidad. La consulta no lleva
 * filtro de `tipo` ni de `dest`: los dos son de la consulta, no de la ruta, y por
 * eso aquí no se pasan y las dos preguntan el calendario tal cual.
 *
 * El envelope y los nueve campos por evento son los de antes, y el `id` es el
 * mismo que en `/api/actividades`: `agendaSlug`, no un aleatorio. Ver
 * `app/api/actividades/route.ts`, que tiene el porqué largo de los dos.
 */
export async function GET() {
  try {
    const eventos = await scrapeMunicipalCalendar({ calendariosID: 566 });

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
    console.error("Error al obtener los eventos de Navidad:", error);
    return NextResponse.json(
      { error: "Error al consultar eventos" },
      { status: 500 }
    );
  }
}