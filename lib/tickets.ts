import { SOURCE_DATA } from "./source-data";

/**
 * Ids de las fuentes donde el botón dice "Comprar entradas" en vez de "Más
 * información". Se deriva del registro en vez de mantenerse a mano porque es
 * justo lo que antes se quedó viejo: una lista de ids escrita a mano se
 * desincroniza en silencio el día que una fuente cambia de id, y el síntoma es
 * un slug crudo en pantalla en lugar de un error.
 *
 * El criterio está en el propio registro, en el campo `tickets`: salas con
 * venta directa y plataformas de venta. No son "todas las fuentes": el
 * Ayuntamiento anuncia conciertos pero no vende entradas, y una fuente que
 * solo agrega no las vende por sí misma.
 */
export const TICKET_SOURCES: ReadonlySet<string> = new Set(
  SOURCE_DATA.filter((e) => e.tickets).map((e) => e.id)
);

export function isTicketSource(source?: string): boolean {
  return !!source && TICKET_SOURCES.has(source);
}
