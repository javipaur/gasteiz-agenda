import { getAgendaEventos, type AgendaEvento } from "./agenda";
import { mapToCultureCategory } from "./categories";
import { CULTURE_SOURCE_IDS } from "./source-data";

export { CULTURE_SOURCES, CULTURE_SOURCE_PILLS, CULTURE_SOURCE_LABELS } from "./cultura-sources";

/**
 * Un `AgendaEvento` con la `category` ya colapsada al cubo de vista.
 *
 * La taxonomía real de quince categorías no se pierde: vive en el evento del
 * agregado, y aquí solo se sustituye la etiqueta que la vista pinta y filtra.
 * Por eso es un `Omit` de `category` y no un tipo nuevo con seis campos: si
 * mañana el agregado gana un campo, esta vista lo hereda sin tocarla.
 */
export type CulturaEvento = Omit<AgendaEvento, "category"> & {
  category: string;
};

/**
 * Vista de cultura sobre el agregado: no scrapea, filtra.
 *
 * Antes este módulo corría nueve scrapers y los cacheaba bajo `cultura-eventos`,
 * aparte de `agenda-all`, y de paso renombraba la categoría a uno de los cuatro
 * cubos que pintan `/culture` y `/culture/[categoria]`. Ese colapso se conserva
 * intacto, pero deja de ser un paso de normalización para ser un filtro sobre
 * `category`.
 */
export async function getCultureEventos(): Promise<CulturaEvento[]> {
  const agenda = await getAgendaEventos();
  const permitidos = new Set(CULTURE_SOURCE_IDS);

  return agenda
    .filter((ev) => permitidos.has(ev.source))
    .map((ev) => ({ ...ev, category: mapToCultureCategory(ev.category) }));
}
