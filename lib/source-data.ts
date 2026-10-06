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
  /**
   * Fecha en ISO, cuando `date` no lo es y no puede cambiarse porque alguien
   * fuera de aquí la lee en otro formato.
   *
   * Existe por `buscametas-inscripciones`: el móvil parte la fecha con
   * `split('/')`, así que la ruta `/api/actividades/carreras/inscripciones`
   * tiene que servir `dd/mm/yyyy` sí o sí, y `new Date("04/10/2026")` no es 4 de
   * octubre sino 9 de abril. Antes de este campo eso descartaba 17 de las 21
   * inscripciones de Álava por `normalizeRaw` y fechaba la última en noviembre.
   *
   * Es una pista de **entrada**, no un campo del evento: `normalizeRaw` lo
   * resuelve y el `AgendaEvento` resultante solo lleva `date`. Un scraper no
   * debería inventarlo —solo convertir lo que el sitio publica—, y una fuente sin
   * fecha se sigue descartando, que es la regla del repo.
   */
  dateIso?: string;
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
  /**
   * TTL propio, en milisegundos, para el `run` de esta fuente. Opcional a
   * propósito: ausente, la fuente se cubre con el `agenda-all` de 5 min y no
   * hay nada que declarar. Presente, `aggregate` envuelve su `run` con una
   * caché bajo la clave `source:${id}` y este TTL.
   *
   * Existe para las fuentes cuyo coste no lo justifica la frecuencia con la que
   * se repiten: cada hit es una descarga grande, y con el TTL de 5 min del
   * agregado se repite cada cinco minutos aunque nadie haya abierto la web. Solo
   * se declara donde está medido, porque un TTL aquí es una decisión sobre la
   *_sdk_ de cada fuente —una cartelera cultural aguanta dos horas, un resultado
   * de búsqueda no— y ponerlo por simetría en las 28 sería adivinar.
   */
  cacheTtlMs?: number;
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
/**
 * Capa propia de las entradas que van a `CalendarioServlet`.
 *
 * 2 h como `rula`, y por el mismo motivo de fondo: una fuente que pega fuerte y
 * gordo al servidor necesita su propia capa. Aquí el peso no son 6,5 MB por
 * petición, son **hasta 13 peticiones por arranque**: la ventana de doce meses se
 * pide una vez y, si vuelve llena, `lib/sources/municipal.ts` la repite mes a mes.
 * Con 18 entradas, un arranque en frío son del orden de 200 peticiones, y sin esto
 * el `agenda-all` de 5 minutos las repetiría cada cinco minutos.
 *
* Es el mismo TTL y no uno menor porque el calendario municipal cambia a ritmo de
 * día, no de minuto: entre una llamada y la siguiente dos horas más tarde hay como
 * mucho un par de altas nuevas, y la que se pierde por no haberla visto sigue
 * colgada en la web municipal.
 */
const CACHE_MUNICIPAL_MS = 2 * 60 * 60 * 1000;

export const SOURCE_DATA: readonly SourceData[] = [
  { id: "municipal-agenda", group: "municipal", label: "Ayuntamiento", category: "Otros", culture: true, cacheTtlMs: CACHE_MUNICIPAL_MS, priority: 0 },
  { id: "municipal-teatro", group: "municipal", label: "Ayuntamiento", category: "Teatro", culture: true, cacheTtlMs: CACHE_MUNICIPAL_MS, priority: 0 },
  // La red municipal de teatros es un `calendariosID` aparte del `tipo: [13]` de
  // arriba, no una variante de él. Ninguna de las dos entradas contiene a la otra:
  // el 392 son los teatros de los centros cívicos (Félix Petite en Ibaiondo, Jesús
  // Ibáñez de Matauco en Hegoalde, Federico García Lorca en Lakua, el punto de
  // encuentro de Aldabe y el Palacio de Congresos), y son 46 eventos en el año.
  //
  // Se dejó aparte porque todo lo que se sabe de ella se puede comprobar contra
  // este id, y una entrada que mezcla dos consultas no se puede auditar.
  { id: "municipal-teatros", group: "municipal", label: "Ayuntamiento", category: "Teatro", culture: true, cacheTtlMs: CACHE_MUNICIPAL_MS, priority: 0 },
  { id: "municipal-conciertos", group: "municipal", label: "Ayuntamiento", category: "Música", culture: true, cacheTtlMs: CACHE_MUNICIPAL_MS, priority: 0 },
  { id: "municipal-exposiciones", group: "municipal", label: "Ayuntamiento", category: "Exposiciones", culture: true, cacheTtlMs: CACHE_MUNICIPAL_MS, priority: 0 },
  { id: "municipal-general", group: "municipal", label: "Ayuntamiento", cacheTtlMs: CACHE_MUNICIPAL_MS, priority: 1 },
  { id: "municipal-deporte", group: "municipal", label: "Ayuntamiento", category: "Deporte", kind: "agenda", cacheTtlMs: CACHE_MUNICIPAL_MS, priority: 0 },
  // Los seis tipos que no consultaba nadie, medido el 5 de octubre de 2026 contra
  // el `filtros` que devuelve el propio servlet. Los catorce `tipo` del calendario
  // 196 son estos, y solo se estaban filtrando cinco: 6, 13, 2, 7 y el que se
  // creía estar usando el de visitas guiadas, que no lo estaba (ver
  // `municipal-visitas` más abajo).
  //
  //   3 Charla / Conferencia         51 filas   47 eventos que no salían de otra parte
  //   10 Cursos y talleres            50 filas   30
  //   4  Danza                        10 filas   10
  //   12 Proyección audiovisual        6 filas    6
  //   9  Fiesta                        5 filas    2
  //   1  Concurso / Campeonato        2 filas    2
  //
  // Cada uno necesita su propia entrada y su propio `tipo`, y no por gusto: **el
  // servlet no acepta un array de varios `tipo`**. Los catorce juntos devuelven 47
  // eventos distintos frente a los 386 que salen de catorce peticiones separadas, y
  // el campo `tipo` de la respuesta viene siempre `null`, así que una petición
  // múltiple no dejaría ni los eventos ni su categoría. Medido, no supuesto.
  //
  // **Lo que decía este párrafo estaba equivocado, y la corrección es una
  // medición y no una opinión.** Decía que el 14 «Feria» y el 11 «Presentación»
  // se dejaban fuera a propósito porque no tienen categoría propia y por siete
  // eventos no compensaba. Se volvió a medir el 6 de octubre de 2026 contra el
  // array `filtros` del propio servlet: el 14 trae **44** y no 4, y casi todos son
  // mercados. Los dos entran dos entradas más abajo, y
  // `__tests__/sources/municipal-tipos.test.ts` es lo que no deja que vuelvan a
  // caerse. El 99 «Otros» sí se deja fuera, y por el motivo de siempre: lo coge
  // `municipal-general` sin filtro, así que una entrada para él sería una
  // petición por nada.
  { id: "municipal-charlas", group: "municipal", label: "Ayuntamiento", category: "Conferencias", culture: true, cacheTtlMs: CACHE_MUNICIPAL_MS, priority: 0 },
  { id: "municipal-talleres", group: "municipal", label: "Ayuntamiento", category: "Talleres", culture: true, cacheTtlMs: CACHE_MUNICIPAL_MS, priority: 0 },
  { id: "municipal-danza", group: "municipal", label: "Ayuntamiento", category: "Danza", culture: true, cacheTtlMs: CACHE_MUNICIPAL_MS, priority: 0 },
  { id: "municipal-cine", group: "municipal", label: "Ayuntamiento", category: "Cine", culture: true, cacheTtlMs: CACHE_MUNICIPAL_MS, priority: 0 },
  { id: "municipal-fiestas", group: "municipal", label: "Ayuntamiento", category: "Fiestas", culture: true, cacheTtlMs: CACHE_MUNICIPAL_MS, priority: 0 },
  { id: "municipal-concursos", group: "municipal", label: "Ayuntamiento", category: "Deporte", cacheTtlMs: CACHE_MUNICIPAL_MS, priority: 0 },
  // Los dos tipos que faltaban, medidos el 6 de octubre de 2026. El guard de
  // `__tests__/sources/municipal-tipos.test.ts` es lo que los tiene marcados.
  //
  // El 14 trae 44 eventos que no salían de ninguna parte, y **casi todos son
  // mercados**: "Mercado de Lakua-Arriaga", "Mercado de la Plaza Simón Bolívar",
  // "Mercado de la Plaza Santa Bárbara", "Mercado dominical de coleccionismo",
  // "Mercado de la Almendra", "Feria de bodas". El Ayuntamiento los agrupa bajo
  // "Feria" porque es su taxonomía interna; para quien busca planes un domingo por
  // la mañana, son mercados. Por eso la categoría se llama Mercados aunque el tipo
  // se llame Feria.
  //
  // El 11 trae 3 eventos y los tres son de libro: "Feria del Libro: Coloquio con
  // Palabra Joven", "Feria del Libro: Entrevista y firma con Mikel Santiago",
  // "Presentación de libro". Van a Conferencias, que ya existe: dos de los tres son
  // colloquia y el tercero es una presentación. Una categoría "Libros" con tres
  // eventos obligaría a darle color, peso y página para un cubo que no llega a cinco.
  { id: "municipal-mercados", group: "municipal", label: "Ayuntamiento", category: "Mercados", cacheTtlMs: CACHE_MUNICIPAL_MS, priority: 0 },
  { id: "municipal-presentaciones", group: "municipal", label: "Ayuntamiento", category: "Conferencias", culture: true, cacheTtlMs: CACHE_MUNICIPAL_MS, priority: 0 },
  { id: "municipal-infantil", group: "municipal", label: "Ayuntamiento", tags: ["infantil"], cacheTtlMs: CACHE_MUNICIPAL_MS, priority: 0 },
  // Va la última de las de priority 0 por el mismo motivo que `municipal-general`
  // va por detrás de todas: si el sitio municipal ignorara el `tipo` desconocido
  // y devolviera el calendario entero, esta llamada se comería el `kind` de
  // `municipal-deporte` y los `tags` de `municipal-infantil`. Al ir última solo
  // gana eventos que ninguna otra variante reclama, y frente a `municipal-general`
  // (priority 1) sigue ganando, que es lo que queremos: lo que solo está en
  // visitas guiadas conserva `category: "Visitas"`.
  //
  // **El `tipo` es el número 15 y no una cadena, y el comentario que antes decía
  // lo contrario estaba equivocado.** Se preguntaba con `tipo: ["visitias
  // guiadas"]`, y el servlet solo acepta números: medido el 5 de octubre de 2026,
  // `"Visita guiada"`, `"visita guiada"`, `"VISITA GUIADA"` y `"visitias guiadas"`
  // devuelven **0** cada una, y `[15]` devuelve 50. Cuatro formas de cadena, cuatro
  // ceros: no era una variante sin tilde que el sitio esperase, era un error
  // tipográfico, y la entrada llevaba tiempo trayendo exactamente nada.
  // `__tests__/source-registry.test.ts` prohíbe ahora las cadenas en `tipo`.
  { id: "municipal-visitas", group: "municipal", label: "Ayuntamiento", category: "Visitas", cacheTtlMs: CACHE_MUNICIPAL_MS, priority: 0 },
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
  { id: "rula", label: "La Genterula", culture: true, cacheTtlMs: 2 * 60 * 60 * 1000, priority: 3 },
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
