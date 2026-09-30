import { getAgendaEventos, type AgendaEvento } from "./agenda";

export type Evento = AgendaEvento;

/**
 * Las cuatro fuentes que `/conciertos` enseña, por id del registro.
 *
 * Antes esta página no tenía una lista: `app/conciertos/page.tsx` llamaba a
 * `scrapeAllConciertos()`, que corría Jimmy Jazz, HellDorado y Musikaze por su
 * cuenta, y el cuarto grupo —los conciertos que anuncia el Ayuntamiento— no
 * aparecía. Al leer el agregado, la lista tiene que ser explícita, porque
 * "todas las fuentes con `category: "Música"`" añadiría también `vam-conciertos` y
 * con ella los conciertos de VAM, que esta página nunca ha tenido. Lo que se
 * amplía es lo que el registro ya traía y la lista decide: la agenda unificada
 * no es un motivo para cambiar el alcance de una página.
 *
 * La lista se escribe a mano y aun así la vigila `__tests__/agenda-views.test.ts`:
 * un id mal escrito no da error, da una página vacía, que es el mismo síntoma que
 * fazia inútil el filtro por recinto cuando las claves estaban a mano.
 *
 * No confundir con `lib/sources/conciertos.ts`, que es el scraper de la sala que
 * sigue usando `/api/actividades/conciertos`.
 */
export const CONCIERTO_SOURCE_IDS: readonly string[] = [
  "municipal-conciertos",
  "jimmyjazz",
  "helldorado",
  "musikaze",
];

/**
 * Vista de conciertos sobre el agregado: no scrapea, filtra.
 *
 * Lo que cambia respecto a la versión que se va no es el listado sino de dónde
 * salen los eventos. `scrapeAllConciertos()` hacía su propio `Promise.allSettled`,
 * su propio dedupe por `título|fecha` y su propia ordenación, y ponía el id con
 * `crypto.randomUUID()`: cada visita a la página generaba ids nuevos, así que un
 * concierto guardado como favorito desde aquí se apagaba solo, y `/evento/[slug]`
 * no podía resolver nada de esta página. Al salir del agregado, el `slug` viene
 * resuelto y el id es el slug, como en el resto del sitio.
 *
 * `getAgendaEventos()` descarta lo que ya ha pasado; `scrapeAllConciertos` no lo
 * hacía y `scrapeJimmyJazz` devuelve la cartelera entera. Es una diferencia a
 * favor: un concierto de la semana pasada no es un concierto.
 */
export async function getConciertosEventos(): Promise<Evento[]> {
  const agenda = await getAgendaEventos();
  const permitidos = new Set(CONCIERTO_SOURCE_IDS);

  return agenda.filter((ev) => permitidos.has(ev.source));
}
