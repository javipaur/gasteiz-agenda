import { scrapeMunicipalCalendar } from "./sources/municipal";
import { scrapeMunicipalRss } from "./sources/municipal-rss";
import { scrapeVamEvents, scrapeVamConciertos } from "./sources/vam";
import { scrapeFever } from "./sources/fever";
import { scrapeRula } from "./sources/rula";
import { scrapeGasteizHoy } from "./sources/gasteizhoy";
import { scrapeEuskadi } from "./sources/euskadi";
import { scrapeJimmyJazz } from "./sources/jimmyjazz";
import { scrapeHelldorado } from "./sources/helldorado";
import { scrapeMusikaze } from "./sources/musikaze";
import { scrapeEventbrite } from "./sources/eventbrite";
import { scrapeEntradium } from "./sources/entradium";
import { scrapeVital } from "./sources/vital";
import { scrapeArkabia } from "./sources/arkabia";
import { scrapeMiniature } from "./sources/miniature";
import {
  scrapeBuscametasCalendario,
  scrapeBuscametasInscripciones,
} from "./sources/buscametas";
import { scrapeSenderismo } from "./sources/senderismo";
import { scrapeFiestasBlanca } from "./sources/fiestas-blanca";

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
  run: () => Promise<RawLike[]>;
  category?: string;
  kind?: string;
  tags?: readonly string[];
  culture?: boolean;
  /**
   * Fiabilidad del dato, y qué fuente se queda con el evento cuando dos
   * declaran el mismo. En una colisión por título+fecha gana la de menor
   * número. A igualdad de prioridad gana el orden del array.
   */
  priority: number;
};

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
export const SOURCE_REGISTRY: readonly SourceEntry[] = [
  { id: "municipal-agenda", group: "municipal", label: "Ayuntamiento", priority: 0, culture: true, run: () => scrapeMunicipalCalendar({ tipo: [6] }), category: "Otros" },
  { id: "municipal-teatro", group: "municipal", label: "Ayuntamiento", priority: 0, culture: true, run: () => scrapeMunicipalCalendar({ tipo: [13] }), category: "Teatro" },
  { id: "municipal-conciertos", group: "municipal", label: "Ayuntamiento", priority: 0, culture: true, run: () => scrapeMunicipalCalendar({ tipo: [2] }), category: "Música" },
  { id: "municipal-exposiciones", group: "municipal", label: "Ayuntamiento", priority: 0, culture: true, run: () => scrapeMunicipalCalendar({ tipo: [7] }), category: "Exposiciones" },
  // La cadena va sin tilde a propósito: es lo que espera el sitio municipal, y
  // la ruta que lo consume en producción es /api/actividades/eventos/agenda/visitas.
  { id: "municipal-visitas", group: "municipal", label: "Ayuntamiento", priority: 0, run: () => scrapeMunicipalCalendar({ tipo: ["visitias guiadas"] }), category: "Visitas" },
  { id: "municipal-general", group: "municipal", label: "Ayuntamiento", priority: 1, run: () => scrapeMunicipalCalendar() },
  { id: "municipal-deporte", group: "municipal", label: "Ayuntamiento", priority: 0, run: () => scrapeMunicipalCalendar({ calendariosID: 168 }), category: "Deporte", kind: "agenda" },
  { id: "municipal-infantil", group: "municipal", label: "Ayuntamiento", priority: 0, run: () => scrapeMunicipalCalendar({ dest: ["infantil"] }), tags: ["infantil"] },
  { id: "municipal-rss", group: "municipal", label: "Ayuntamiento (RSS)", priority: 1, run: () => scrapeMunicipalRss() },
  { id: "vam", group: "vam", label: "VAM", priority: 1, run: () => scrapeVamEvents() },
  { id: "vam-conciertos", group: "vam", label: "VAM", priority: 1, culture: true, run: () => scrapeVamConciertos(), category: "Música" },
  { id: "euskadi", label: "Euskadi", priority: 1, run: () => scrapeEuskadi() },
  { id: "senderismo", group: "cm-gazteiz", label: "CM Gazteiz", priority: 1, run: () => scrapeSenderismo(), category: "Senderismo", kind: "excursiones", tags: ["senderismo"] },
  { id: "fiestas-blanca", label: "La Blanca", priority: 1, run: () => scrapeFiestasBlanca(), category: "Fiestas", tags: ["la-blanca"] },
  { id: "jimmyjazz", label: "Jimmy Jazz", priority: 2, culture: true, run: () => scrapeJimmyJazz(), category: "Música" },
  { id: "helldorado", label: "HellDorado", priority: 2, run: () => scrapeHelldorado(), category: "Música" },
  { id: "musikaze", label: "Musikaze", priority: 2, run: () => scrapeMusikaze(), category: "Música" },
  { id: "fever", label: "Fever", priority: 3, culture: true, run: () => scrapeFever() },
  { id: "rula", label: "La Genterula", priority: 3, culture: true, run: () => scrapeRula() },
  { id: "gasteizhoy", label: "Gasteiz Hoy", priority: 3, culture: true, run: () => scrapeGasteizHoy() },
  { id: "eventbrite", label: "Eventbrite", priority: 4, run: () => scrapeEventbrite() },
  { id: "entradium", label: "Entradium", priority: 4, run: () => scrapeEntradium() },
  { id: "vital", label: "Fundación Vital", priority: 4, run: () => scrapeVital() },
  { id: "arkabia", label: "Arkabia", priority: 4, run: () => scrapeArkabia() },
  { id: "miniature", label: "Miniature", priority: 4, run: () => scrapeMiniature(), category: "Gastronomía" },
  { id: "buscametas-calendario", group: "buscametas", label: "Buscametas", priority: 5, run: () => scrapeBuscametasCalendario(), category: "Deporte", kind: "calendario" },
  { id: "buscametas-inscripciones", group: "buscametas", label: "Buscametas", priority: 5, run: () => scrapeBuscametasInscripciones(), category: "Deporte", kind: "inscripciones" },
];

export function sourceGroup(entry: SourceEntry): string {
  return entry.group ?? entry.id;
}

export const CULTURE_SOURCE_IDS: readonly string[] = SOURCE_REGISTRY.filter(
  (e) => e.culture
).map((e) => e.id);

// Indexados por `id`, nunca por `group`: varias entradas comparten label
// ("Ayuntamiento" siete veces, "VAM" dos, "Buscametas" dos) y un mapa por
// `group` las fundiría, que es justo el bug de etiquetas que esto arregla.
export const SOURCE_LABELS: Record<string, string> = Object.fromEntries(
  SOURCE_REGISTRY.map((e) => [e.id, e.label])
);

export const SOURCE_GROUPS: Record<string, string> = Object.fromEntries(
  SOURCE_REGISTRY.map((e) => [e.id, sourceGroup(e)])
);
