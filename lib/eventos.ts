import { getAgendaEventos, type AgendaEvento } from "./agenda";

/**
 * Alias histórico. `AgendaEvento` es el tipo único desde la unificación; se
 * mantiene el nombre para no romper los imports de `/api/v1/events`,
 * `scripts/send-newsletter.ts`, `lib/turismo.ts` y `lib/gastronomia.ts`.
 */
export type Evento = AgendaEvento;

/**
 * Wrapper de una línea sobre el agregador único. La firma se mantiene para no
 * tocar los consumidores ni `/api/v1/events`.
 *
 * Antes esta función scrapeaba doce fuentes por su cuenta y las cacheaba bajo
 * `eventos-proximos`, aparte de `agenda-all`. Además el `id` lo generaba con
 * `crypto.randomUUID()`, así que cambiaba en cada re-scraping y los favoritos
 * guardados no volvían a coincidir. Ahora el id es el slug, que es estable.
 */
export async function getProximosEventos(options?: {
  startDate?: string;
  endDate?: string;
}): Promise<Evento[]> {
  const eventos = await getAgendaEventos();

  if (!options?.startDate) return eventos;

  const filterStart = new Date(options.startDate);
  if (isNaN(filterStart.getTime())) return eventos;

  const filterEnd = options.endDate
    ? new Date(options.endDate)
    : new Date(filterStart);
  filterEnd.setHours(23, 59, 59, 999);

  return eventos.filter((e) => {
    const d = new Date(e.date);
    return d >= filterStart && d <= filterEnd;
  });
}
