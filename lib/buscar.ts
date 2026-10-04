import { getAgendaEventos, type AgendaEvento } from "./agenda";
import { localDateStr } from "./utils";
import { SOURCE_LABELS } from "./source-data";

/**
 * Buscar en el agregado entero, no en una vista.
 *
 * Vive en `lib/` y no dentro del route handler porque lo consumen dos: la API del
 * desplegable de la cabecera y la página `/buscar`. Antes solo existía lo primero,
 * y el enlace "Ver todos los resultados" apuntaba a `/culture?q=`, que es una vista
 * sobre 9 de las 28 fuentes. El resultado eran seis eventos de una carrera o de un
 * concierto de VAM y luego una página vacía, sin error: el embudo se rompía en el
 * último paso y no había ningún tipo de fallo que delatara que faltaba una ruta.
 *
 * Que busque sobre `getAgendaEventos()` entero es la decisión, y la razón de que
 * `/buscar` sea una página aparte en vez de un filtro de `/culture` es que una
 * página titulada "cultura" mostrando la agenda de Senderismo confunde.
 */

/** Un resultado, en la forma que devuelven la API y la página. */
export type BuscarHit = {
  /**
   * Igual que `slug`, y por el mismo motivo que en `AgendaEvento`: el id es el
   * slug, no un identificador opaco. Se expone explícitamente y no se deja que
   * cada consumidor lo rellene, porque `EventCardEvento` lo exige y escribir
   * `id: hit.slug` en dos sitios son dos sitios que pueden divergir.
   */
  id: string;
  slug: string;
  title: string;
  date: string;
  image?: string;
  location?: string;
  category?: string;
  source: string;
};

/** Tope por defecto. Antes eran 6, y el desplegable hacía `slice(0, 7)` encima. */
export const BUSCAR_LIMITE_POR_DEFECTO = 24;
export const BUSCAR_LIMITE_MAXIMO = 100;

/** Menos de dos letras no es una búsqueda: "a" matchea casi toda la agenda. */
export const BUSCAR_MIN_CARACTERES = 2;

/**
 * Lo que se mira de un evento, en minúsculas, una vez.
 *
 * Se incluye la etiqueta de la fuente porque buscar "VAM" o "Ayuntamiento" es una
 * pregunta real, y sin esto el resultado dependería de que el título de la ficha
 * mencione al museo, que no suele pasar. No se incluye la descripción: es texto
 * crudo del tercero, sin cota, y un evento cuya descripción mencione "teatro"
 * aparecería en la búsqueda de teatro sin que sea un evento de teatro.
 *
 * **El nombre de la ciudad se quita del lugar.** `normalizeRaw` rellena
 * `location` con `"Vitoria-Gasteiz"` cuando la fuente no dice dónde es, así que el
 * haystack de casi todo evento contiene la palabra "vitoria". Con la ciudad dentro,
 * buscar "vitoria" —la primera palabra que escribe quien busca algo aquí— devuelve
 * la agenda entera, que es lo mismo que no tener buscador. Y quitarla no pierde
 * nada: la ciudad no es un dato del evento, es el sitio donde está este sitio.
 */
function textoBuscable(ev: AgendaEvento): string {
  const lugar = (ev.location || "").toLowerCase().includes("vitoria")
    ? ""
    : ev.location || "";
  return `${ev.title} ${lugar} ${ev.category || ""} ${SOURCE_LABELS[ev.source] ?? ev.source}`.toLowerCase();
}

/** Hoy o posterior, en día local. `getAgendaEventos` ya quita el pasado. */
function esHoyOViejo(ev: AgendaEvento, hoy: Date): boolean {
  if (localDateStr(new Date(ev.date)) === localDateStr(hoy)) return true;
  return new Date(ev.date) >= hoy;
}

export type BuscarOpts = {
  limit?: number;
  offset?: number;
};

/**
 * Los eventos que casan con la consulta, y cuántos hay en total.
 *
 * El `total` viene aparte porque sin él una lista recortada es indistinguible de
 * una lista corta: quien busca y ve seis filas no sabe si hay seis o seiscientos.
 * Es lo mismo que hace mal `/culture/[categoria]` al Pintar "70 próximos eventos" y
 * enseñar 60.
 */
/**
 * Recorta un número que viene de fuera —un `?limit=abc`, un `Number(undefined)`
 * que es `NaN`— al rango válido.
 *
 * No se puede confiar en el valor por defecto del parámetro para esto: los
 * valores por defecto de JavaScript solo aplican a `undefined` en la llamada, y el
 * route handler pasa `Number(params.get("limit"))`, que para un parámetro ausente
 * es `NaN` y no `undefined`. Un `Math.min(NaN, 100)` da `NaN`, y un
 * `slice(desde, desde + NaN)` devuelve lista vacía: una búsqueda con un parámetro
 * mal escrito devolvería cero resultados en vez de la lista por defecto, y el
 * síntoma sería "no hay nada" otra vez.
 */
function recorte(valor: number, porDefecto: number, maximo: number): number {
  if (!Number.isFinite(valor)) return porDefecto;
  return Math.max(1, Math.min(Math.floor(valor), maximo));
}

export async function buscarAgenda(
  consulta: string,
  { limit, offset }: BuscarOpts = {}
): Promise<{ results: BuscarHit[]; total: number }> {
  const q = consulta.trim().toLowerCase();
  if (q.length < BUSCAR_MIN_CARACTERES) return { results: [], total: 0 };

  const eventos = await getAgendaEventos();
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const terminos = q.split(/\s+/).filter(Boolean);

  const casan = eventos
    .filter((ev) => esHoyOViejo(ev, hoy))
    .filter((ev) => {
      const haystack = textoBuscable(ev);
      // Todos los términos, no cualquiera: "jazz vitoria" tiene que dar jazz en
      // Vitoria, no las dos cosas por separado.
      return terminos.every((termino) => haystack.includes(termino));
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const limite = recorte(limit ?? NaN, BUSCAR_LIMITE_POR_DEFECTO, BUSCAR_LIMITE_MAXIMO);
  const desde = Number.isFinite(offset) ? Math.max(0, Math.floor(offset as number)) : 0;

  return {
    total: casan.length,
    results: casan.slice(desde, desde + limite).map((ev) => ({
      id: ev.slug,
      slug: ev.slug,
      title: ev.title,
      date: ev.date,
      image: ev.image,
      location: ev.location,
      category: ev.category,
      source: ev.source,
    })),
  };
}
