import { getAgendaEventos, type AgendaEvento } from "./agenda";

export type Evento = AgendaEvento;

/**
 * Los cuatro tramos que `SportPageClient` sabe filtrar. Es una lista blanca y
 * coincides con el `CATEGORIES` del componente: un `kind` nuevo se descarta aquí,
 * porque mostrarse con una etiqueta que ninguna pill filtra es peor que no
 * mostrarse.
 */
const TRAMOS = new Set(["agenda", "calendario", "inscripciones", "excursiones"]);

/**
 * Vista de deporte sobre el agregado: no scrapea, filtra.
 *
 * Antes este módulo corría cuatro scrapers y los cacheaba bajo
 * `deporte-eventos-mood`, y `app/deporte/page.tsx` hacía lo mismo otra vez bajo
 * `deporte-eventos`: dos fuentes de verdad para los mismos eventos, con
 * `crypto.randomUUID()` por id. Ahora las dos leen el mismo agregado.
 *
 * `category` se sobrescribe con `kind` porque es lo que el componente cliente
 * filtra y lo que pintaba la etiqueta de la tarjeta. El tipo dice `category:
 * string` y aquí vale "agenda": es un truthy, no una taxonomía. La categoría real
 * no se tira, vive en el evento del agregado.
 */
export async function getDeporteEventos(): Promise<Evento[]> {
  const agenda = await getAgendaEventos();

  return agenda
    .filter((ev) => ev.kind && TRAMOS.has(ev.kind))
    .map((ev) => ({ ...ev, category: ev.kind as string }));
}
