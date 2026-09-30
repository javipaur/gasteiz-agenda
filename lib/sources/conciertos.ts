import { scrapeJimmyJazz as scrapeJimmyJazzRaw } from "./jimmyjazz";

export interface ConciertoEvent {
  title: string;
  date: string;
  image: string;
  location: string;
  link: string;
  description: string;
  venue: string;
}

/**
 * Jimmy Jazz con la forma que espera `/api/actividades/conciertos`.
 *
 * Este módulo ya no scrapea la cartelera de conciertos: eso lo hace el registro de
 * `lib/source-registry.ts`, del que beben la home, `/conciertos` y `/culture`. Lo
 * que queda es el envoltorio de la ruta de la API, que expone el recinto en un
 * campo `venue` propio. Por eso sobrevive `lib/sources/conciertos.ts` después de que
 * `scrapeAllConciertos()` y sus dos ayudantes privados dejaran de tener
 * consumidores: borrarlo entero rompería el `import` de
 * `app/api/actividades/conciertos/route.ts`, y cambiar esa ruta es parte de la Fase
 * 2 de seguridad, con su propio plan.
 */
export async function scrapeJimmyJazz(): Promise<ConciertoEvent[]> {
  const events = await scrapeJimmyJazzRaw();
  return events.map((e) => ({
    ...e,
    image: e.image || "",
    description: "",
    venue: "Jimmy Jazz Gasteiz",
  }));
}
