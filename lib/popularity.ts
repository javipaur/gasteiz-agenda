import { SOURCE_GROUPS } from "./source-data";
// `import type` y no `import`: TypeScript lo borra al compilar, y este módulo lo
// carga `HeroSection`, que es `"use client"`. Un import de valor aquí arrastraría
// a `lib/eventos` → `lib/agenda` → el registro compuesto → los 18 scrapers al
// bundle del navegador. La regla la comprueba `__tests__/source-data.test.ts`.
import type { Evento } from "./eventos";

/**
 * Peso por familia de fuentes, indexado por el `group` del registro y no por id.
 *
 * Por qué `group` y no `id`: el Ayuntamiento son nueve entradas del registro
 * (`municipal-agenda`, `-teatro`, `-conciertos`, `-exposiciones`, `-general`,
 * `-deporte`, `-infantil`, `-visitas` y `-rss`) y todas comparten `group:
 * "municipal"`. Escribirlas una por una es una lista mantenida a mano que se
 * pudre en cuanto se añada una variante, que es exactamente como murió
 * `"vitoria-gasteiz"`: un id que emitía el módulo viejo y que, al dejar de
 * emitirlo, dejó a la fuente con más volumen de la agenda puntuando el mínimo
 * por defecto, sin que nada se quejara.
 *
 * Por qué no se deriva de los otros campos del registro:
 *
 * - `priority` va de 0 a 5 y la revisión de la T1 documentó que **no** es una
 *   escala de prestigio: `buscametas` está en 5 y `senderismo` en 1, y los dos
 *   son fuentes oficiales. Usarla como peso puntuaría al club municipal por encima
 *   del Ayuntamiento.
 * - `tickets` dice quién **vende entradas**, no quién es más fiable: subiría a
 *   Eventbrite y Entradium a la altura de Fever y no diría nada del Ayuntamiento,
 *   que es justamente el que anuncia más cosas y no vende.
 * - `culture` solo vale para `/culture`.
 *
 * Los seis valores que aparecen aquí son los que tenía la tabla antes de la
 * unificación, con `vitoria-gasteiz` renombrado a su familia. Lo que no sale es una
 * familia nueva ponderada: las salas con venta directa, las plataformas y CM
 * Gazteiz se quedan en el mínimo, que es donde estaban. Cambiar eso es una
 * decisión de producto sobre qué es "popular" en Vitoria-Gasteiz, no el arreglo de
 * un id muerto, así que no se ha hecho aquí.
 *
 * Se exportan las dos tablas para que un test pueda atacar las dos invariantes
 * que si no no se pueden comprobar: que no haya claves muertas y que ninguna
 * fuente real se quede en el mínimo por descuido.
 */
export const SOURCE_WEIGHT: Readonly<Partial<Record<string, number>>> = {
  fever: 40,
  municipal: 25,
  euskadi: 20,
  gasteizhoy: 20,
  vam: 18,
  rula: 15,
};

const PESO_FUENTE_POR_DEFECTO = 5;

function pesoFuente(source?: string): number {
  if (!source) return PESO_FUENTE_POR_DEFECTO;
  // `SOURCE_GROUPS` es `Partial` a propósito, así que el fallback es obligatorio
  // para el typechecker: si el id no está en el mapa, su propio id es su grupo.
  const grupo = SOURCE_GROUPS[source] ?? source;
  return SOURCE_WEIGHT[grupo] ?? PESO_FUENTE_POR_DEFECTO;
}

/**
 * Peso por categoría, con las dieciséis que `normalizeCategory` produce de verdad:
 * las mismas de `CATEGORY_COLORS`.
 *
 * Nueve números vienen de la tabla anterior y conservan su valor. Dos claves
 * muertas se han tenido que llevar a la categoría que sí existe: `"Conciertos"`
 * era `Música` desde antes de la unificación, y `"La Blanca"` es la categoría
 * `Fiestas` (la fuente `fiestas-blanca` la declara así). Las seis que faltaban
 * se colocan por banda, y la banda es la que ya usaba la tabla: espectáculo en
 * escena (Teatro, Danza) por encima de la oferta cultural y formativa
 * (Exposiciones, Visitas, Talleres), que por encima del deporte y el resto
 * (Deporte, Senderismo, Cine, Conferencias). `Otros` se queda en el mínimo de
 * categoría, que es el mismo valor que el `??` de abajo.
 *
 * `Mercados` es la decimosexta y la única que no viene de la cuenta de la agenda
 * sino de un tipo municipal que se acaba de abrir: el 14 «Feria», que trae 44
 * eventos. Va en la banda de 16 con `Gastronomía`, `Visitas` y `Talleres` porque
 * es el mismo registro —algo a lo que se sale, al aire libre y sin entrada—, y
 * **no** en la banda de 22 del espectáculo en escena que traen Teatro y Danza: un
 * mercado de barrio no se programa sobre un escenario. El color que la acompaña,
 * `#E0A34E`, es el ámbar de `Gastronomía` oscurecido, que es lo que menos se
 * parece a un cartel de festival o de sala.
 */
export const CATEGORY_WEIGHT: Readonly<Partial<Record<string, number>>> = {
  Música: 30,
  Festival: 26,
  Fiestas: 25,
  Teatro: 22,
  Danza: 22,
  Exposiciones: 18,
  Infantil: 18,
  Gastronomía: 16,
  Visitas: 16,
  Talleres: 16,
  Mercados: 16,
  Deporte: 14,
  Cine: 12,
  Conferencias: 12,
  Senderismo: 12,
  Otros: 10,
};

const PESO_CATEGORIA_POR_DEFECTO = 10;

export function scoreEvento(e: Evento, today = new Date()): number {
  let score = 0;

  score += pesoFuente(e.source);

  if (e.category) {
    score += CATEGORY_WEIGHT[e.category] ?? PESO_CATEGORIA_POR_DEFECTO;
  }

  if (e.image) score += 15;
  if (e.price) score += 8;
  if (e.rating && e.rating >= 4) score += Math.round(e.rating * 4);
  if (e.description && e.description.length > 80) score += 5;

  const date = new Date(e.date);
  if (!isNaN(date.getTime())) {
    const diffDays = (date.getTime() - today.getTime()) / 86400000;
    if (diffDays >= 0 && diffDays <= 14) {
      score += Math.round((1 - diffDays / 14) * 20);
    }
  }

  return score;
}

export function getPopularEvents(
  eventos: Evento[],
  limit = 10,
  today = new Date()
): Evento[] {
  // El score se calcula aparte y se ordena por él, en vez de meter una propiedad
  // `popularity` en el evento que se devuelve: `AgendaEvento` no declara ese campo
  // (se eliminó en la T2 por YAGNI) y las dos tarjetas que consumen esto —el
  // destacado del hero y el bloque "Populares"— no lo leen.
  //
  // El desempate es la posición de entrada, que es lo que garantizaba el sort
  // estable de V8 cuando dos eventos empataban. Ponerlo explícito evita depender
  // de esa garantía sin escribirlo en ninguna parte.
  return eventos
    .filter((e) => e.image)
    .map((evento, i) => ({ evento, score: scoreEvento(evento, today), i }))
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.evento);
}
