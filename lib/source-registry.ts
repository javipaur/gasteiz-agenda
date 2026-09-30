/**
 * Composición del registro de fuentes: los datos están en `lib/source-data.ts` y
 * aquí se les une la función de scraping de cada una.
 *
 * La separación no es estética. `lib/shared.tsx` es `"use client"` y llama a
 * `sourceLabel`, que vive en `lib/utils.ts`; si `utils.ts` importara este
 * fichero, los 19 scrapers entrarían en el bundle del cliente. Por eso lo que
 * llega a los componentes cliente es `lib/source-data.ts`, y este módulo se
 * queda en el servidor. La regla está comprobada en
 * `__tests__/source-data.test.ts`.
 *
 * Los exports públicos no cambian: quien importaba de aquí sigue importando de
 * aquí.
 */

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

import { SOURCE_DATA, type RawLike, type SourceEntry } from "./source-data";
/**
 * Función de scraping por id. La clave es el `id` de la entrada de datos, así que
 * añadir una fuente son dos líneas: su datos en `SOURCE_DATA` y su scraper aquí.
 * `composite` falla al cargar el módulo si alguna se queda sin `run`, que es
 * mejor que devolver una entrada muda y descubrirlo en la agenda.
 */
const RUNNERS: Record<string, () => Promise<RawLike[]>> = {
  "municipal-agenda": () => scrapeMunicipalCalendar({ tipo: [6] }),
  "municipal-teatro": () => scrapeMunicipalCalendar({ tipo: [13] }),
  "municipal-conciertos": () => scrapeMunicipalCalendar({ tipo: [2] }),
  "municipal-exposiciones": () => scrapeMunicipalCalendar({ tipo: [7] }),
  "municipal-general": () => scrapeMunicipalCalendar(),
  "municipal-deporte": () => scrapeMunicipalCalendar({ calendariosID: 168 }),
  "municipal-infantil": () => scrapeMunicipalCalendar({ dest: ["infantil"] }),
  "municipal-visitas": () => scrapeMunicipalCalendar({ tipo: ["visitias guiadas"] }),
  "municipal-rss": () => scrapeMunicipalRss(),
  vam: () => scrapeVamEvents(),
  "vam-conciertos": () => scrapeVamConciertos(),
  euskadi: () => scrapeEuskadi(),
  senderismo: () => scrapeSenderismo(),
  "fiestas-blanca": () => scrapeFiestasBlanca(),
  jimmyjazz: () => scrapeJimmyJazz(),
  helldorado: () => scrapeHelldorado(),
  musikaze: () => scrapeMusikaze(),
  fever: () => scrapeFever(),
  rula: () => scrapeRula(),
  gasteizhoy: () => scrapeGasteizHoy(),
  eventbrite: () => scrapeEventbrite(),
  entradium: () => scrapeEntradium(),
  vital: () => scrapeVital(),
  arkabia: () => scrapeArkabia(),
  miniature: () => scrapeMiniature(),
  "buscametas-calendario": () => scrapeBuscametasCalendario(),
  "buscametas-inscripciones": () => scrapeBuscametasInscripciones(),
};

export const SOURCE_REGISTRY: readonly SourceEntry[] = SOURCE_DATA.map((data) => {
  const run = RUNNERS[data.id];
  if (!run) {
    throw new Error(
      `Falta la función de scraping de "${data.id}" en RUNNERS de lib/source-registry.ts`
    );
  }
  return { ...data, run };
});

// Los datos, los mapas derivados y los tipos viven en `lib/source-data.ts`; aquí
// solo se les añade `run`. Se reexportan para que quien ya importaba de este
// módulo no tenga que cambiar ni un import. `export type` y no `export` porque el
// proyecto tiene `isolatedModules`.
export {
  CULTURE_SOURCE_IDS,
  SOURCE_GROUPS,
  SOURCE_LABELS,
  sourceGroup,
} from "./source-data";
export type { RawLike, SourceEntry };
