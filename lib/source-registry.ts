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
  group: string;
  label: string;
  run: () => Promise<unknown[]>;
  category?: string;
  kind?: string;
  tags?: readonly string[];
  culture?: boolean;
  priority: number;
};

// Prioridad: municipal manda, después las fuentes oficiales, y al final las
// agregadoras comerciales. En una colisión por título+fecha gana la de menor
// número, que es la que suele traer la ficha más completa.
export const SOURCE_REGISTRY: readonly SourceEntry[] = [
  { id: "municipal-agenda", group: "municipal", label: "Ayuntamiento", priority: 0, culture: true, run: () => scrapeMunicipalCalendar({ tipo: [6] }), category: "Otros" },
  { id: "municipal-teatro", group: "municipal", label: "Ayuntamiento", priority: 0, culture: true, run: () => scrapeMunicipalCalendar({ tipo: [13] }), category: "Teatro" },
  { id: "municipal-conciertos", group: "municipal", label: "Ayuntamiento", priority: 0, culture: true, run: () => scrapeMunicipalCalendar({ tipo: [2] }), category: "Música" },
  { id: "municipal-exposiciones", group: "municipal", label: "Ayuntamiento", priority: 0, culture: true, run: () => scrapeMunicipalCalendar({ tipo: [7] }), category: "Exposiciones" },
  { id: "municipal-general", group: "municipal", label: "Ayuntamiento", priority: 0, run: () => scrapeMunicipalCalendar() },
  { id: "municipal-deporte", group: "municipal", label: "Ayuntamiento", priority: 0, run: () => scrapeMunicipalCalendar({ calendariosID: 168 }), category: "Deporte", kind: "agenda" },
  { id: "municipal-infantil", group: "municipal", label: "Ayuntamiento", priority: 0, run: () => scrapeMunicipalCalendar({ dest: ["infantil"] }), tags: ["infantil"] },
  { id: "municipal-rss", group: "municipal", label: "Ayuntamiento (RSS)", priority: 1, run: () => scrapeMunicipalRss() },
  { id: "vam", group: "vam", label: "VAM", priority: 1, run: () => scrapeVamEvents() },
  { id: "vam-conciertos", group: "vam", label: "VAM", priority: 1, culture: true, run: () => scrapeVamConciertos(), category: "Música" },
  { id: "euskadi", group: "euskadi", label: "Euskadi", priority: 1, run: () => scrapeEuskadi() },
  { id: "senderismo", group: "cm-gazteiz", label: "CM Gazteiz", priority: 1, run: () => scrapeSenderismo(), category: "Senderismo", kind: "excursiones", tags: ["senderismo"] },
  { id: "fiestas-blanca", group: "fiestas-blanca", label: "La Blanca", priority: 1, run: () => scrapeFiestasBlanca(), category: "Fiestas", tags: ["la-blanca"] },
  { id: "jimmyjazz", group: "jimmyjazz", label: "Jimmy Jazz", priority: 2, culture: true, run: () => scrapeJimmyJazz(), category: "Música" },
  { id: "helldorado", group: "helldorado", label: "HellDorado", priority: 2, run: () => scrapeHelldorado(), category: "Música" },
  { id: "musikaze", group: "musikaze", label: "Musikaze", priority: 2, run: () => scrapeMusikaze(), category: "Música" },
  { id: "fever", group: "fever", label: "Fever", priority: 3, culture: true, run: () => scrapeFever() },
  { id: "rula", group: "rula", label: "La Genterula", priority: 3, culture: true, run: () => scrapeRula() },
  { id: "gasteizhoy", group: "gasteizhoy", label: "Gasteiz Hoy", priority: 3, culture: true, run: () => scrapeGasteizHoy() },
  { id: "eventbrite", group: "eventbrite", label: "Eventbrite", priority: 4, run: () => scrapeEventbrite() },
  { id: "entradium", group: "entradium", label: "Entradium", priority: 4, run: () => scrapeEntradium() },
  { id: "vital", group: "vital", label: "Fundación Vital", priority: 4, run: () => scrapeVital() },
  { id: "arkabia", group: "arkabia", label: "Arkabia", priority: 4, run: () => scrapeArkabia() },
  { id: "miniature", group: "miniature", label: "Miniature", priority: 4, run: () => scrapeMiniature(), category: "Gastronomía" },
  { id: "buscametas-calendario", group: "buscametas", label: "Buscametas", priority: 5, run: () => scrapeBuscametasCalendario(), category: "Deporte", kind: "calendario" },
  { id: "buscametas-inscripciones", group: "buscametas", label: "Buscametas", priority: 5, run: () => scrapeBuscametasInscripciones(), category: "Deporte", kind: "inscripciones" },
];

export const CULTURE_SOURCE_IDS: readonly string[] = SOURCE_REGISTRY.filter(
  (e) => e.culture
).map((e) => e.id);

export const SOURCE_LABELS: Record<string, string> = Object.fromEntries(
  SOURCE_REGISTRY.map((e) => [e.id, e.label])
);
