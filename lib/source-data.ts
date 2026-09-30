/**
 * Hoja pura del registro de fuentes: aquí viven los datos y nada más.
 *
 * El motivo de que este fichero exista por separado de `lib/source-registry.ts`
 * es que `lib/shared.tsx` es `"use client"` y llama a `sourceLabel`, que está en
 * `lib/utils.ts`. Si `utils.ts` importara el registro compuesto, los 18 scrapers
 * entrarían en el grafo de cliente: medido con `next build`, el chunk compartido
 * de la home pasaba de 146 KB a 403 KB, con el parsing de cheerio que el
 * navegador nunca ejecuta y con el token de la API MEC de La Genterula dentro.
 *
 * Regla que hay que mantener: **nada alcanzable desde un componente cliente puede
 * llegar a un scraper.** Eso se comprueba en `__tests__/source-data.test.ts`, que
 * recorre el grafo de imports y falla si un `"use client"` toca `lib/sources/`.
 * Por eso este fichero no importa nada.
 */

export type RawLike = {
  title?: string;
  date?: string;
  dateEnd?: string;
  time?: string;
  timeStart?: string;
  image?: string;
  location?: string;
  venue?: string;
  link?: string;
  url?: string;
  description?: string;
  category?: string;
  cancelled?: boolean;
  price?: string;
  rating?: number;
};

export type SourceEntry = {
  id: string;
  /** Por defecto, igual a `id`. Solo se declara cuando agrupa varias entradas. */
  group?: string;
  label: string;
  /** La aporta `lib/source-registry.ts` al componer; aquí no se rellena. */
  run: () => Promise<RawLike[]>;
  category?: string;
  kind?: string;
  tags?: readonly string[];
  culture?: boolean;
  /**
   * Que en esta fuente se compran entradas de verdad: salas con venta directa y
   * plataformas de venta. Es lo que decide que el botón diga "Comprar entradas"
   * en vez de "Más información", así que no se marca a la ligera: el Ayuntamiento
   * no vende entradas aunque anuncie conciertos, y una fuente que solo agrega
   * no las vende por sí misma.
   */
  tickets?: boolean;
  /**
   * Fiabilidad del dato, y qué fuente se queda con el evento cuando dos
   * declaran el mismo. En una colisión por título+fecha gana la de menor
   * número. A igualdad de prioridad gana el orden del array.
   */
  priority: number;
};

/** Una entrada del registro antes de que se le añada su función de scraping. */
export type SourceData = Omit<SourceEntry, "run">;

// `priority` no es una jerarquía de prestigio, es qué fuente se cree antes. Los
// números actuales no siguen un orden temático estricto —`buscametas` está en 5
// y `senderismo` en 1, y los dos son oficiales—, así que no los leas como una
// escala: léelos como la confianza que depositas en la ficha de cada fuente.
//
// A igualdad de prioridad gana el orden del array, y no es un detalle: `jimmyjazz`
// y `musikaze` empatan en 2, y el scraper de Musikaze devuelve también eventos de
// Jimmy Jazz, así que el orden decide cuál de los dos se queda con ellos.
//
// `municipal-general` va por detrás a propósito: sin filtro devuelve también todo
// lo que ya devuelven las variantes tipadas, y si compartiera prioridad se
// quedaría delante de `municipal-deporte` y `municipal-infantil` en el desempate,
// se comería su `kind` y sus `tags`, y `/deporte` y `/kids` saldrían vacíos.
export const SOURCE_DATA: readonly SourceData[] = [
  { id: "municipal-agenda", group: "municipal", label: "Ayuntamiento", category: "Otros", culture: true, priority: 0 },
  { id: "municipal-teatro", group: "municipal", label: "Ayuntamiento", category: "Teatro", culture: true, priority: 0 },
  { id: "municipal-conciertos", group: "municipal", label: "Ayuntamiento", category: "Música", culture: true, priority: 0 },
  { id: "municipal-exposiciones", group: "municipal", label: "Ayuntamiento", category: "Exposiciones", culture: true, priority: 0 },
  { id: "municipal-general", group: "municipal", label: "Ayuntamiento", priority: 1 },
  { id: "municipal-deporte", group: "municipal", label: "Ayuntamiento", category: "Deporte", kind: "agenda", priority: 0 },
  { id: "municipal-infantil", group: "municipal", label: "Ayuntamiento", tags: ["infantil"], priority: 0 },
  // Va la última de las de priority 0 por el mismo motivo que `municipal-general`
  // va por detrás de todas: si el sitio municipal ignorara el `tipo` desconocido
  // y devolviera el calendario entero, esta llamada se comería el `kind` de
  // `municipal-deporte` y los `tags` de `municipal-infantil`. Al ir última solo
  // gana eventos que ninguna otra variante reclama, y frente a `municipal-general`
  // (priority 1) sigue ganando, que es lo que queremos: lo que solo está en
  // visitas guiadas conserva `category: "Visitas"`.
  // La cadena va sin tilde a propósito: es lo que espera el sitio municipal, y
  // la ruta que lo consume en producción es /api/actividades/eventos/agenda/visitas.
  { id: "municipal-visitas", group: "municipal", label: "Ayuntamiento", category: "Visitas", priority: 0 },
  { id: "municipal-rss", group: "municipal", label: "Ayuntamiento (RSS)", priority: 1 },
  { id: "vam", group: "vam", label: "VAM", tickets: true, priority: 1 },
  { id: "vam-conciertos", group: "vam", label: "VAM", category: "Música", culture: true, tickets: true, priority: 1 },
  { id: "euskadi", label: "Euskadi", priority: 1 },
  { id: "senderismo", group: "cm-gazteiz", label: "CM Gazteiz", category: "Senderismo", kind: "excursiones", tags: ["senderismo"], priority: 1 },
  { id: "fiestas-blanca", label: "La Blanca", category: "Fiestas", tags: ["la-blanca"], priority: 1 },
  { id: "jimmyjazz", label: "Jimmy Jazz", category: "Música", culture: true, tickets: true, priority: 2 },
  { id: "helldorado", label: "HellDorado", category: "Música", tickets: true, priority: 2 },
  { id: "musikaze", label: "Musikaze", category: "Música", tickets: true, priority: 2 },
  { id: "fever", label: "Fever", culture: true, tickets: true, priority: 3 },
  { id: "rula", label: "La Genterula", culture: true, priority: 3 },
  { id: "gasteizhoy", label: "Gasteiz Hoy", culture: true, priority: 3 },
  { id: "eventbrite", label: "Eventbrite", tickets: true, priority: 4 },
  { id: "entradium", label: "Entradium", tickets: true, priority: 4 },
  { id: "vital", label: "Fundación Vital", priority: 4 },
  { id: "arkabia", label: "Arkabia", priority: 4 },
  { id: "mercado-abastos", label: "Mercado de Abastos", priority: 4 },
  { id: "miniature", label: "Miniature", category: "Gastronomía", priority: 4 },
  { id: "buscametas-calendario", group: "buscametas", label: "Buscametas", category: "Deporte", kind: "calendario", priority: 5 },
  { id: "buscametas-inscripciones", group: "buscametas", label: "Buscametas", category: "Deporte", kind: "inscripciones", priority: 5 },
];

// Todo lo que se deriva de los datos y no necesita un scraper vive aquí, en el
// lado del cliente. `lib/source-registry.ts` los reexporta para no romper a quien
// ya importaba de allí.

export function sourceGroup(entry: { id: string; group?: string }): string {
  return entry.group ?? entry.id;
}

export const CULTURE_SOURCE_IDS: readonly string[] = SOURCE_DATA.filter(
  (e) => e.culture
).map((e) => e.id);

// Indexados por `id`, nunca por `group`: varias entradas comparten label
// ("Ayuntamiento" ocho veces, "VAM" dos, "Buscametas" dos) y un mapa por `group`
// las fundiría, que es justo el bug de etiquetas que esto arregla.
//
// `Partial` y no `Record` a propósito: sin `noUncheckedIndexedAccess` en el
// tsconfig, `Record<string, string>` le dice al typechecker que
// `SOURCE_LABELS[loQueSea]` es `string` siempre, y entonces el `??` de quien lo
// consume parece código muerto y un refactor futuro podría borrarlo sin que
// `tsc` se queje. Con `Partial`, una búsqueda que no está en el mapa se tipa
// `string | undefined` y el fallback pasa a ser obligatorio.
export const SOURCE_LABELS: Partial<Record<string, string>> = Object.fromEntries(
  SOURCE_DATA.map((e) => [e.id, e.label])
);

export const SOURCE_GROUPS: Partial<Record<string, string>> = Object.fromEntries(
  SOURCE_DATA.map((e) => [e.id, sourceGroup(e)])
);
