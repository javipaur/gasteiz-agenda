import { getCachedOrFetch } from "./cache";
import { agendaLink, agendaSlug, localDateKey, slugify } from "./slug";
import { tituloCancelado } from "./cancelaciones";
import { normalizeCategory } from "./categories";
import { desescaparHtml } from "./html-entities";
import { SOURCE_REGISTRY, type RawLike, type SourceEntry } from "./source-registry";
import { registrarImportacionSegura } from "./event-ledger";
import { logger } from "./axiom/server";
import { getArchivedEventoBySlug, getRecoveredAgendaEvents } from "./archived-events";
import { leerEstadoPorSlug, leerEstadoPorTrackingId, resolverAliasSlug } from "./event-ledger";
import { isDegradedSourceReadError } from "./source-degraded";
import { fetchOgImage } from "./og-image";
import { imagenServible } from "./image-hosts";

/**
 * Lo que se ve cuando nadie dice dónde es el evento. Vive en una constante
 * porque `app/evento/[slug]/page.tsx` la usa como señal para decidir si añade la
 * localidad al texto, así que el valor no puede repartirse en dos literales.
 */
const SIN_LUGAR = "Vitoria-Gasteiz";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function externalIdEstable(raw: RawLike): string | undefined {
  const candidato = (raw.externalId ?? raw.sourceId ?? raw.id ?? "").toString().trim();
  if (!candidato) return undefined;
  // Evitar IDs generados al vuelo (no estables entre ejecuciones/scrapes).
  if (UUID_RE.test(candidato)) return undefined;
  return candidato;
}

export type AgendaEvento = {
  id: string;
  slug: string;
  /** ID externo estable de la fuente de origen, cuando la fuente lo expone (no inventado). */
  externalId?: string;
  title: string;
  date: string;
  dateEnd?: string;
  time?: string;
  image?: string;
  location: string;
  link: string;
  description?: string;
  category: string;
  source: string;
  kind?: string;
  tags?: string[];
  cancelled?: boolean;
  price?: string;
  rating?: number;
  /** Web oficial del evento/organizador, cuando es distinta de la ficha/enlace principal. */
  officialUrl?: string;
  /**
   * Cuántos ids de fuente contaban este evento antes del dedupe.
   *
   * El dedupe se queda con un ganador y roba al perdedor `image`, `description` y
   * `location`; este número se perdía con el resto, y era el más informative de los
   * cuatro: no dice cómo queda el evento, sino **cuánta gente lo anuncia**. Un
   * concierto que sale en el Ayuntamiento, en VAM y en Fever es más real que uno que
   * solo aparece en la web de una sala, y esa era la señal que faltaba para que
   * "recomendado" no fuera solo el ranking de popularidad de `lib/popularity.ts`.
   *
   * Opcional, y no por pereza: los muchos tests que construyen `AgendaEvento` a mano
   * no lo declaran, y hacerlo obligatorio los rompería todos de golpe. Quien lo
   * consume lo trata como `?? 1`, que es lo que vale un evento que solo cuenta una
   * fuente.
   */
  corrobora?: number;

  /**
   * Los días en que ocurre, cuando son más de uno. Lo rellena
   * `colapsarDiasConsecutivos` de `lib/recomendados.ts`, no el agregador: el agregado
   * no sabe qué eventos son el mismo plan en dos fechas.
   *
   * **Opcional y sin valor cuando el evento pasa un solo día**, porque en ese caso la
   * tarjeta ya enseña `date` y un campo que siempre está lleno no informa de nada.
   */
  dias?: string[];

  /** Estado conocido para URLs recuperadas/archivadas/retiradas con información contrastada. */
  recoveredState?: "recuperado" | "archivado" | "retirado";
  /** Procedencia o nota breve del estado conocido. */
  provenance?: string;
};

/**
 * Cómo se construyó el agregado que hay en caché ahora mismo.
 *
 * Existe porque `aggregate` usa `Promise.allSettled`: si 15 de 28 scrapers fallan,
 * lo único que sale es un `logger.warn` y el agregado se devuelve más corto. Quien
 * lo consume —la web, la API, el digest del push— no tiene forma de distinguir
 * "hoy hay 400 eventos" de "hoy solo han respondido 13 fuentes". Un motor de
 * búsqueda que llamara a esta API contestaría con la mitad de la agenda y con
 * toda la confianza, que es exactamente el modo de fallo que este repo ya corrigió
 * una vez en `municipal`, `rula`, `farmacias` y `search`: una lista vacía que no
 * dice que está vacía.
 *
 * Con esto, quien lo sirva puede decirlo. `sources` se llama así y no `fuentes`
 * porque el resto del identificador está en castellano y la mitad de los campos de
 * `AgendaEvento` lo están también; el nombre inglés es el que usa la documentación
 * de MCP para este tipo de dato.
 */
export type AgendaMeta = {
  /** Cuándo se construyó el agregado, en ISO. Es la construcción, no la lectura. */
  scrapedAt: string;
  /** Cuántas fuentes hay en el registro que se han consultado. */
  sourcesTotal: number;
  /** Cuántas han respondido, aunque sea con lista vacía. */
  sourcesOk: number;
  /** Las que no han respondido, con el motivo. */
  sourcesFallidas: { id: string; error: string }[];
};

/** Lo que se guarda en la caché `agenda-all`. */
type AgendaCacheada = { eventos: AgendaEvento[]; meta: AgendaMeta };

function normalizeRaw(raw: RawLike, entry: SourceEntry): AgendaEvento | null {
  // Las entidades se desescapan **antes de nada**, y el orden importa: el slug se
  // deriva del título, así que decodificar después dejaría dos formas del mismo
  // texto conviviendo —la del agregador y la de `agendaSlug`— y un favorito
  // guardado apuntaría a un id que ya no existe. Aquí se limpia una vez y todos
  // los consumidores —web, app, carrusel y boletín— leen lo mismo.
  const title = desescaparHtml((raw.title || "").trim());
  if (!title || title === "Sin título") return null;

  // `dateIso` manda sobre `date` porque hay fuentes cuyo `date` no es parseable y
  // no puede cambiarse: el móvil de `buscametas-inscripciones` la parte con
  // `split('/')`, así que la ruta tiene que servir `dd/mm/yyyy`. Con
  // `new Date("04/10/2026")` V8 devuelve el 9 de abril, que no es un error de
  // formato sino una lectura equivocada en silencio. La comprobación de validez va
  // contra la fecha **resuelta**, no contra `raw.date`: si `dateIso` tampoco
  // parsea, el evento se descarta igual y esta puerta no se convierte en un
  // atajo para fabricar fechas.
  const date = raw.dateIso || raw.date || "";
  if (!date || isNaN(new Date(date).getTime())) return null;

  const link = agendaLink(raw);
  // El slug lo resuelve `agendaSlug`, no `eventSlug` a pelo: la normalización
  // (trim del título, `#` como enlace vacío) tiene que ser la misma en todos los
  // sitios que lo calculan —la migración de favoritos, las tarjetas de La Blanca,
  // su JSON-LD— y por eso vive en `lib/slug.ts` y no aquí. Aquí se decide el
  // `id`; en ningún otro sitio se vuelve a decidir.
  //
  // Se le pasa `{ ...raw, date }` y no `raw` a propósito: `agendaSlug` lee
  // `raw.date`, que en una fuente con las dos fechas es la que no parsea, y el
  // evento aparecería en octubre con un slug que dice abril. O sea que el slug
  // tiene que derivarse de la misma fecha que el campo `date`, y el único sitio
  // que sabe cuál es esa fecha es este.
  const slug = agendaSlug({ ...raw, date });
  const category = normalizeCategory(entry.category ?? raw.category);
  const externalId = externalIdEstable(raw);

  return {
    id: slug,
    slug,
    externalId,
    title,
    date,
    dateEnd: raw.dateEnd || undefined,
    time: (raw.time || raw.timeStart || "").trim() || undefined,
    image: raw.image?.startsWith("http") ? raw.image : undefined,
    location: desescaparHtml((raw.location || raw.venue || "").trim()) || SIN_LUGAR,
    link,
    description: raw.description ? desescaparHtml(raw.description.trim()) || undefined : undefined,
    category,
    source: entry.id,
    kind: entry.kind,
    tags: entry.tags && entry.tags.length ? [...entry.tags] : undefined,
    // El campo no basta: dos fuentes escriben el aviso dentro del título y dejan
    // `cancelled` vacío, así que el filtro de abajo no los veía. El porqué largo
    // y la medición están en `lib/cancelaciones.ts`.
    cancelled: raw.cancelled || tituloCancelado(title) || undefined,
    price: typeof raw.price === "string" ? raw.price : undefined,
    rating: typeof raw.rating === "number" ? raw.rating : undefined,
    officialUrl:
      typeof raw.officialUrl === "string" && /^https?:\/\//.test(raw.officialUrl)
        ? raw.officialUrl
        : undefined,
  };
}

function dedupeKey(ev: AgendaEvento): string {
  // La fecha va por `localDateKey` y no por `ev.date.slice(0, 10)` porque la
  // cadena cruda es UTC y el día que ve el usuario es el local: un
  // `new Date(2027, 0, 15).toISOString()` es `...T23:00:00.000Z` del día 14 en
  // Europe/Madrid, así que el prefijo ISO señalaría el día equivocado y la misma
  // pareja de eventos deduplicaría en Dokploy y no en local. Al ser el mismo
  // normalizador que usa `eventSlug`, las dos claves no pueden divergir.
  // El título va por `normalizarParaComparar` y no por `toLowerCase().trim()`
  // porque las fuentes escriben el mismo plan con comillas, dos puntos o acentos
  // distintos: medido el 5 de noviembre de 2026, 33 parejas del mismo día eran
  // el mismo plan con el título igual tras normalizar y distinto en crudo
  // (`"RESISTENCIA EN LA RESIDENCIA` frente a `Resistencia en la Residencia`,
  // `MOTÖRHITS` frente a `MOTORHEAD`). Se colaban por las dos puertas: esta no
  // las veía y la de contención no funde dos títulos que ya son iguales. Las 33
  // medidas eran duplicados de verdad, sin un solo falso positivo.
  return `${normalizarParaComparar(ev.title)}|${localDateKey(ev.date)}`;
}

/**
 * El mínimo de caracteres que tiene que tener el título corto para que se pueda
 * decir que está contenido en el largo.
 *
 * Sin este suelo, `Deserto` se fusiona con cualquier cosa que lleve la palabra
 * dentro, y `Concierto` con `Concierto de Año Nuevo`. Seis es donde el título
 * corto ya es un nombre y no una etiqueta.
 */
const MINIMO_TITULO_CONTENIDO = 6;

/** Longitud mínima de un token de recinto para que cuente como distintivo. */
const MINIMO_TOKEN_RECINTO = 4;

/**
 * Las palabras que nombran un **tipo** de sitio y no un sitio.
 *
 * `Centro Cívico Lakua` y `Centro Cívico Hegoalde` comparten dos tokens de
 * recinto y son dos planes distintos: lo que los separa es justo el que no es
 * genérico. Con esta lista fuera, un mismo título a la misma hora en dos centros
 * cívicos se fusionaría y desaparecería uno de los dos.
 */
const RECINTOS_GENERICOS = new Set([
  "centro",
  "civico",
  "biblioteca",
  "teatro",
  "antzokia",
  "sala",
  "casa",
  "cultural",
  "kulturunea",
  "espacio",
  "museo",
  "palacio",
  "fundacion",
  "adultos",
  "vitoria",
  "gasteiz",
  "jardin",
  "parque",
]);

/**
 * El título sin acentos, sin puntuación y en minúsculas.
 *
 * Es la forma en la que se comparan los títulos de dos fuentes, y **no es la
 * forma en la que se muestran**: aquí solo se decide si dos fichas son el mismo
 * plan, y para eso `«Ardi batek kontatutako ipuinak»` y
 * `"Ardi batek kontatutako ipuinak"` tienen que ser la misma cadena.
 */
function normalizarParaComparar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Los tokens de un recinto, sin repetir y sin los que no distinguen nada. */
function tokensDeRecinto(recinto: string): string[] {
  const tokens = normalizarParaComparar(recinto)
    .split(" ")
    .filter((t) => t.length >= MINIMO_TOKEN_RECINTO && !RECINTOS_GENERICOS.has(t));
  return [...new Set(tokens)];
}

/**
 * La hora de un evento como `HH:MM`, o `null` si no la tiene.
 *
 * Las fuentes la escriben de cinco maneras: `19:30`, `19.30`, `19:30h`,
 * `19:30 - 21:00` y `19:30:00`. Se queda la primera que aparezca y se rellena a
 * dos dígitos, porque `9:30` y `09:30` son la misma hora y compararlas como
 * cadenas las separaría.
 */
function horaNormalizada(time: string | undefined): string | null {
  if (!time) return null;
  const m = /(\d{1,2})[:.h](\d{2})/.exec(time);
  if (!m) return null;
  const horas = Number(m[1]);
  const minutos = Number(m[2]);
  if (horas > 23 || minutos > 59) return null;
  return `${String(horas).padStart(2, "0")}:${m[2]}`;
}

/**
 * Si un título está contenido en el otro como **secuencia de palabras
 * completas**, y el corto es lo bastante largo para ser un nombre.
 *
 * Por palabras y no por subcadena: `Arte` está dentro de `Martes` como subcadena
 * y no como título.
 */
function titulosSeSolapan(a: AgendaEvento, b: AgendaEvento): boolean {
  const na = normalizarParaComparar(a.title);
  const nb = normalizarParaComparar(b.title);
  if (!na || !nb || na === nb) return false;

  const [corto, largo] = na.length <= nb.length ? [na, nb] : [nb, na];
  if (corto.length < MINIMO_TITULO_CONTENIDO) return false;
  return ` ${largo} `.includes(` ${corto} `);
}

/** Si los dos recintos comparten al menos un token que no sea genérico. */
function recintosCompatibles(a: AgendaEvento, b: AgendaEvento): boolean {
  const suyos = new Set(tokensDeRecinto(b.location));
  return tokensDeRecinto(a.location).some((t) => suyos.has(t));
}

/** `Visita guiada a la exposición…`, en su forma normalizada. */
const ETIQUETA_VISITA_GUIADA = /\bvisitas? guiadas?\b/;

/**
 * El único caso medido en el que dos fichas que se parecen **no son el mismo
 * plan**: la exposición y la visita guiada a esa misma exposición.
 *
 * Se publican con el mismo título casi entero, el mismo día, la misma hora y el
 * mismo recinto, así que todas las demás señales dicen que son la misma cosa. La
 * que las separa es la etiqueta del principio. Se exige que la lleve **una sola**
 * de las dos: si la llevan las dos, son dos fuentes publicando la misma visita
 * guiada y sí se fusionan.
 */
function unaEsVisitaGuiadaYLaOtraNo(a: AgendaEvento, b: AgendaEvento): boolean {
  const visita = (ev: AgendaEvento) => ETIQUETA_VISITA_GUIADA.test(normalizarParaComparar(ev.title));
  return visita(a) !== visita(b);
}

/**
 * `2ª FUNCIÓN`, `segunda sesión`, `2º pase`, `tercer pase`, en su forma
 * normalizada: `normalizarParaComparar` convierte `2ª FUNCIÓN` en `2 funcion`, así
 * que la etiqueta se busca ya sin ordinal volado ni acentos.
 */
const ETIQUETA_FUNCION_EXTRA =
  /\b(?:[2-9][ao]?\s*(?:funcion|sesion|pase|representacion)|(?:segund|tercer|cuart)[oa]?\s+(?:funcion|sesion|pase|representacion))\b/;

/**
 * El único caso medido en el que «una trae hora y la otra no» se equivoca: la
 * segunda función del mismo espectáculo, que una fuente publica sin hora.
 *
 * Es la misma forma que la visita guiada —todas las demás señales dicen «el mismo
 * plan» y una etiqueta del título dice que no— y por eso la regla es la misma: se
 * exige que la lleve **una sola** de las dos. Si la llevan las dos, son dos
 * fuentes publicando la misma segunda función y sí se fusionan.
 */
function unaEsFuncionExtraYLaOtraNo(a: AgendaEvento, b: AgendaEvento): boolean {
  const extra = (ev: AgendaEvento) =>
    ETIQUETA_FUNCION_EXTRA.test(normalizarParaComparar(ev.title));
  return extra(a) !== extra(b);
}

/**
 * Intenta completar la imagen de los eventos que no traen ninguna, usando la
 * página a la que enlazan (og:image / twitter:image / primera imagen útil).
 *
 * Es el último recurso común: si la fuente no trae imagen, la imagen más
 * relacionada con el evento suele estar en su propia ficha. Solo se asigna si
 * la URL resultante es servible por la lista blanca de `image-hosts`; si el
 * host no está permitido, no se muestra (y habría que añadirlo explícitamente).
 *
 * No corre en build ni en tests por defecto para no lanzar peticiones externas
 * ni ralentizar suites que ya ejercitan el agregado; en tests se puede forzar
 * con `AGENDA_ENRICH_IMAGES_FORCE=1`. Va en lotes para no abrir demasiadas
 * conexiones a la vez. Un fallo de enriquecimiento no puede tumbar el agregado.
 */
async function enriquecerImagenesFaltantes(eventos: AgendaEvento[]): Promise<void> {
  if (process.env.NEXT_BUILD) return;
  if (process.env.JEST_WORKER_ID && process.env.AGENDA_ENRICH_IMAGES_FORCE !== "1") return;

  const missing = eventos.filter(
    (e) => !e.image && !!e.link && /^https?:\/\//.test(e.link)
  );
  if (missing.length === 0) return;

  const CONCURRENCY = 5;
  for (let i = 0; i < missing.length; i += CONCURRENCY) {
    const chunk = missing.slice(i, i + CONCURRENCY);
    await Promise.allSettled(
      chunk.map(async (e) => {
        const ogImage = await fetchOgImage(e.link);
        // Solo se guarda si la imagen se puede pintar con la lista blanca actual;
        // si el host no está permitido, mejor dejar el fallback que guardar una URL
        // que la UI tendría que descartar.
        if (ogImage && imagenServible(ogImage)) {
          e.image = ogImage;
        }
      })
    );
  }
}

/** Si el evento dura varios días, no solo el día en que empieza. */
function esMultidia(evento: AgendaEvento): boolean {
  if (!evento.dateEnd) return false;
  return localDateKey(evento.dateEnd) > localDateKey(evento.date);
}

/**
 * Si dos fichas del mismo día cuentan el mismo plan.
 *
 * La hora no se exige en las dos: se exige que **al menos una** la traiga, para
 * que un `20:00` y un «sin hora» puedan ser el mismo pase y dos «sin hora» no.
 */
function sonElMismoPlan(a: AgendaEvento, b: AgendaEvento): boolean {
  if (!titulosSeSolapan(a, b)) return false;
  if (!recintosCompatibles(a, b)) return false;
  if (unaEsVisitaGuiadaYLaOtraNo(a, b)) return false;
  if (unaEsFuncionExtraYLaOtraNo(a, b)) return false;

  // Un festival de tres días y el concierto suelto de uno de esos días tienen
  // títulos contenidos y el mismo recinto, y son dos planes distintos. Lo que los
  // separa es que uno dura varios días y el otro no.
  if (esMultidia(a) !== esMultidia(b)) return false;

  const horaA = horaNormalizada(a.time);
  const horaB = horaNormalizada(b.time);

  // Dos horas distintas son dos pases: la matinée y la función de la noche del
  // mismo espectáculo se quedan las dos. Sin hora en ninguna de las dos no hay
  // señal de que sea el mismo pase, así que no se toca.
  if (horaA && horaB) return horaA === horaB;
  return Boolean(horaA || horaB);
}

/**
 * Le pasa al ganador lo que el perdedor tiene y a él le falta.
 *
 * `location` es el caso especial: `normalizeRaw` la deja siempre rellena, así que
 * el hueco se reconoce comparando con el valor por defecto y no por falsy.
 */
function heredarDelPerdedor(ganador: AgendaEvento, perdedor: AgendaEvento): void {
  if (!ganador.image && perdedor.image) ganador.image = perdedor.image;
  if (!ganador.description && perdedor.description) ganador.description = perdedor.description;
  if (ganador.location === SIN_LUGAR && perdedor.location !== SIN_LUGAR) {
    ganador.location = perdedor.location;
  }
  // La hora entra en el mismo saco porque la fusión puede juntar una ficha con
  // hora y otra sin ella: quedarse con la del perdedor es lo que evita que el
  // plan que sobrevive pierda el único dato que decía cuándo es.
  if (!ganador.time && perdedor.time) ganador.time = perdedor.time;
  if (!ganador.officialUrl && perdedor.officialUrl) ganador.officialUrl = perdedor.officialUrl;
}

/**
 * La segunda pasada del dedupe: el mismo plan publicado por dos fuentes con
 * títulos que no son idénticos.
 *
 * La primera pasada casa por título exacto, y con 28 fuentes sin esquema eso deja
 * fuera lo que más se ve: `El tiempo de los mitos` y `Banda Municipal de Música de
 * Vitoria-Gasteiz 2026-2027: "El tiempo de los mitos"` son el mismo concierto, y
 * con la clave exacta salen dos veces en el carrusel y dos veces en el boletín.
 *
 * **Se mide antes de escribirlo, y por eso la regla es esta y no otra.** Medido el
 * 4 de noviembre de 2026 sobre 2010 eventos: 60 parejas de títulos contenidos, de
 * las que 36 son la misma cosa con distinto título. Exigir que el recinto corto
 * esté **entero** dentro del largo rechaza 20 de las 60 —`Félix Petite Antzokia`
 * contra `Teatro Félix Petite (Centro Cívico Ibaiondo)`—, así que la regla es
 * «comparten un token de recinto que no sea genérico»: las 60 pasan y las
 * parejas que no son el mismo plan se separan por la etiqueta de visita guiada.
 *
 * **Una de las dos tiene que traer hora, y la otra puede no traerla.** Medido el 5
 * de noviembre de 2026 sobre 1850 eventos: 119 parejas del mismo día se solapan en
 * el título, comparten recinto y solo una de las dos trae hora —`MUERDO (Urban Rock
 * Concept)` a las 20:00 y `Muerdo` sin hora son el mismo concierto—. Eso no es una
 * señal de que sean dos pases: es una fuente que no publica la hora. Sin esta
 * rama, el plan salía dos veces en el carrusel y dos veces en el boletín.
 *
 * **Dos horas distintas no se fusionan**, porque ahí sí hay señal de dos pases:
 * la matinée y la función de la noche del mismo espectáculo se quedan las dos. Y
 * **dos fichas sin hora tampoco**, porque no hay ninguna señal de que sean el
 * mismo pase.
 *
 * **Y una etiqueta de pase extra separa, aunque todo lo demás coincida.** Medido
 * el 5 de noviembre de 2026 sobre 1731 eventos, la única pareja que la rama de
 * arriba fundía y no debía era `DREAMING BUBBLES … 2ª FUNCIÓN` sin hora contra el
 * mismo espectáculo a las 12:30: la segunda ficha es un pase distinto y la fuente
 * simplemente no le puso hora. La etiqueta solo separa cuando la lleva una de las
 * dos, igual que la visita guiada.
 */
function fusionarDuplicadosPorContencion(eventos: readonly AgendaEvento[]): AgendaEvento[] {
  // Se agrupa **por día y nada más**. Agrupar por día y hora dejaba fuera del
  // todo a los eventos sin hora, que son justo la mitad de las parejas reales; y
  // agrupar por hora obligaría a repetir la comparación en cada cubo para juntar
  // un `20:00` con un `sin hora`.
  const porDia = new Map<string, number[]>();
  eventos.forEach((ev, i) => {
    const clave = localDateKey(ev.date);
    const indices = porDia.get(clave);
    if (indices) indices.push(i);
    else porDia.set(clave, [i]);
  });

  const absorbidos = new Set<number>();

  for (const indices of porDia.values()) {
    if (indices.length < 2) continue;
    // El primero de la lista es el que gana, y el orden de la lista es el de
    // prioridad del registro: municipal antes que agregadoras. No se reordena
    // aquí, porque eso sería decidir la fuente ganadora por segunda vez.
    for (let a = 0; a < indices.length; a++) {
      const i = indices[a];
      if (absorbidos.has(i)) continue;
      for (let b = a + 1; b < indices.length; b++) {
        const j = indices[b];
        if (absorbidos.has(j)) continue;
        if (!sonElMismoPlan(eventos[i], eventos[j])) continue;
        heredarDelPerdedor(eventos[i], eventos[j]);
        eventos[i].corrobora = (eventos[i].corrobora ?? 1) + (eventos[j].corrobora ?? 1);
        absorbidos.add(j);
      }
    }
  }

  if (absorbidos.size === 0) return [...eventos];
  return eventos.filter((_, i) => !absorbidos.has(i));
}


/**
 * El agregado, y junto a él cómo se construyó.
 *
 * El que hay dos funciones y no una con un parámetro `conMeta` es para no tocar los
 * quince tests que llaman a `aggregate` esperando un array, y porque la firma corta
 * es la que se usa en el 99% de los sitios. Quien necesite saber si el agregado está
 * completo llama a esta.
 */
export async function aggregateConMeta(
  entries: readonly SourceEntry[]
): Promise<{ eventos: AgendaEvento[]; meta: AgendaMeta }> {
  // Regla de desempate, en este orden y sin excepciones:
  //   1. menor `priority` gana
  //   2. a igual prioridad, gana el que va antes en SOURCE_REGISTRY
  // Array.prototype.sort es estable en V8, así que ordenar por priority basta
  // para que el orden del array sea el desempate. El array está ordenado a mano
  // por grupo: municipal, oficiales, consolidadas, agregadoras.
  const ordered = [...entries].sort((a, b) => a.priority - b.priority);

  const settled = await Promise.allSettled(
    ordered.map((e) => {
      // Solo las fuentes que declaran `cacheTtlMs` tienen capa propia. Las demás
      // las cubre el `agenda-all` de 5 min de abajo, y meterlas aquí sin que lo
      // pidan sería cambiarle el ritmo de frescura a 27 fuentes por el problema de
      // una.
      //
      // `strict: true`: si la fuente solo puede resolverse con datos de respaldo
      // (caché interna/stale), debe señalizarse como degradada para que el ledger
      // no la cuente como lectura sana.
      const runStrict = () => e.run({ strict: true });
      if (!e.cacheTtlMs) return runStrict();
      return getCachedOrFetch(`source:${e.id}`, e.cacheTtlMs, runStrict);
    })
  );

  const collected: AgendaEvento[] = [];
  const sourcesFallidas: { id: string; error: string }[] = [];
  /**
   * Las fuentes que **respondieron de forma sana** en esta importación.
   * Una lectura degradada (datos servidos desde caché interna por fallo actual)
   * no entra aquí: sirve resiliencia al usuario, pero no es confirmación válida
   * para el ledger de ausencias.
   */
  const fuentesSanas: string[] = [];
  /** Fuentes servidas desde respaldo/stale: sus eventos se muestran pero no se
   *  registran como vistos sanos en el ledger. */
  const fuentesDegradadas = new Set<string>();
  settled.forEach((result, i) => {
    const entry = ordered[i];
    if (result.status === "rejected") {
      if (isDegradedSourceReadError(result.reason)) {
        const error = `degradada: ${result.reason.message}`;
        logger.warn("scraping_degraded", { source: entry.id, error });
        sourcesFallidas.push({ id: entry.id, error });
        fuentesDegradadas.add(entry.id);
        for (const raw of result.reason.staleData as RawLike[]) {
          const ev = normalizeRaw(raw, entry);
          if (ev) collected.push(ev);
        }
        return;
      }
      const error =
        result.reason instanceof Error ? result.reason.message : String(result.reason);
      logger.warn("scraping_failed", { source: entry.id, error });
      sourcesFallidas.push({ id: entry.id, error });
      return;
    }
    fuentesSanas.push(entry.id);
    for (const raw of result.value) {
      const ev = normalizeRaw(raw, entry);
      if (ev) collected.push(ev);
    }
  });

  /**
   * El registro de eventos vistos, en **shadow mode**: anota y no decide nada de
   * lo que se sirve. Va sobre `collected`, la lista **antes del dedupe**, porque
   * el ganador del dedupe puede cambiar de una importación a otra —dos fuentes
   * publican el mismo plan y la prioridad decide— y registrar solo al ganador
   * convertiría ese cambio en una ausencia falsa del perdedor.
   *
   * `registrarImportacionSegura` no lanza: si el volumen no está montado, avisa
   * por el log y devuelve `null`. La agenda no puede caerse porque la vigilancia
   * falle.
   */
  registrarImportacionSegura(
    collected
      .filter((ev) => !fuentesDegradadas.has(ev.source))
      .map((ev) => ({
        source: ev.source,
        title: ev.title,
        date: ev.date,
        slug: ev.slug,
        link: ev.link,
        externalId: ev.externalId,
      })),
    fuentesSanas,
    Date.now(),
    ordered.length,
    sourcesFallidas
  );

  const byKey = new Map<string, AgendaEvento>();

  for (const ev of collected) {
    // Antes de mirarlo. Todo evento pasa por aquí una vez, así que `corrobora` es 1
    // para el que no tiene duplicado, y 2, 3… para el que otras fuentes también
    // contaban. Ponerlo aquí y no en la rama del ganador es lo que hace que el
    // número sea "cuántas fuentes lo cuentan" y no "cuántas lo-APARTE": un contador
    // que solo sube en la colisión valdría cero para todo evento sin duplicado.
    ev.corrobora = 1;
    const key = dedupeKey(ev);
    const winner = byKey.get(key);
    if (!winner) {
      byKey.set(key, ev);
      continue;
    }
    // Las fuentes municipales suelen venir sin imagen y las comerciales con,
    // así que se la robamos al perdedor antes de descartarlo.
    heredarDelPerdedor(winner, ev);
    // Una fuente más cuenta este mismo evento. Va después de las herencia de campos
    // porque es lo único que se acumula: las tres de arriba son "rellena un hueco" y
    // esta es "suma uno".
    winner.corrobora = (winner.corrobora ?? 1) + 1;
  }

  // Y una segunda pasada por contención, porque la clave exacta solo caza el mismo
  // título y las fuentes no lo escriben igual. El porqué de cada condición está en
  // `fusionarDuplicadosPorContencion`.
  const fundidos = fusionarDuplicadosPorContencion([...byKey.values()]);

  // Los cancelados se van después del dedupe, no antes: manda la fuente que
  // gana, que es la que más se fía de la ficha. Antes se filtraban aquí mismo,
  // solo que únicamente para La Blanca; sin este filtro un concierto anulado
  // aparece en pantalla igual que uno que va a celebrarse, porque no hay badge
  // de cancelado en ninguna tarjeta y lo único que leería el campo sería el
  // JSON-LD, que además declara lo contrario de lo que ve el usuario.
  const eventos = fundidos
    .filter((ev) => !ev.cancelled)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  await enriquecerImagenesFaltantes(eventos);

  return {
    eventos,
    meta: {
      // El instante de la **construcción**, que es lo que se guarda en la caché. Si
      // se tomara al leer, un `agenda-all` de cinco minutos daría siempre "ahora" y
      // el campo no diría nada.
      scrapedAt: new Date().toISOString(),
      sourcesTotal: ordered.length,
      sourcesOk: ordered.length - sourcesFallidas.length,
      sourcesFallidas,
    },
  };
}

export async function aggregate(
  entries: readonly SourceEntry[]
): Promise<AgendaEvento[]> {
  return (await aggregateConMeta(entries)).eventos;
}

async function fetchAllAgenda(): Promise<AgendaCacheada> {
  return aggregateConMeta(SOURCE_REGISTRY);
}

/**
 * El valor cacheado de `agenda-all`.
 *
 * **La clave lleva versión a propósito.** La caché de `lib/cache.ts` es un fichero
 * JSON en `tmpdir()`, así que sobrevive a un reinicio de Node y en Dokploy
 * sobrevive entre peticiones. Cambiar la forma del valor sin cambiar la clave
 * haría que el primer hit tras el despliegue leyera el fichero viejo —un array
 * pelado— y `cacheada.eventos` sería `undefined`, con un TypeError en la home.
 * Subir a `v2` es más barato que guardar un `typeof` y una rama por cada lectura.
 */
async function getAgendaCacheada(): Promise<AgendaCacheada> {
  const cacheada = await getCachedOrFetch<AgendaCacheada>(
    "agenda-all-v2",
    5 * 60 * 1000,
    fetchAllAgenda
  );

  // Eventos recuperados/contrastados fuera de la ingesta automática (URLs
  // indexadas caídas, programas añadidos a mano). Se integran sin duplicar por
  // slug para que aparezcan en listados y detalle mientras no los sirva una fuente.
  const existentes = new Set(cacheada.eventos.map((ev) => ev.slug));
  const extras = getRecoveredAgendaEvents().filter((ev) => !existentes.has(ev.slug));
  if (extras.length === 0) return cacheada;

  const eventos = [...cacheada.eventos, ...extras].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  return { ...cacheada, eventos };
}

export async function getAgendaEventos(options?: {
  days?: number;
  includePast?: boolean;
}): Promise<AgendaEvento[]> {
  const { eventos } = await getAgendaCacheada();
  let lista = eventos;

  if (!options?.includePast) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    lista = lista.filter((ev) => new Date(ev.date) >= hoy);
  }

  if (options?.days) {
    const limit = new Date();
    limit.setDate(limit.getDate() + options.days);
    lista = lista.filter((ev) => new Date(ev.date) <= limit);
  }

  return lista;
}

/**
 * Cómo se construyó el agregado que se está sirviendo ahora, sin refetch.
 *
 * Comparte la clave `agenda-all-v2` con `getAgendaEventos`, así que leer la salud no
 * dispara un scrape que no dispara ya la agenda. Es lo que hace este par de
 * funciones coherente: preguntar "¿están las 28 fuentes?" no puede ser más caro que
 * cargar la home.
 */
export async function getAgendaSalud(): Promise<AgendaMeta> {
  const { meta } = await getAgendaCacheada();
  return meta;
}

export function findBySlug(
  eventos: readonly AgendaEvento[],
  slug: string
): AgendaEvento | undefined {
  const exacto = eventos.find((ev) => ev.slug === slug);
  if (exacto) return exacto;

  // Los slugs existentes incluyen un hash del enlace de origen, que puede cambiar
  // aunque título y fecha sigan iguales. Resuelve esos enlaces antiguos solo si la
  // parte legible identifica un único evento; ante una colisión, no adivina.
  const coincidencias = eventos.filter((ev) =>
    slug.startsWith(`${slugify(ev.title)}-${localDateKey(ev.date)}-`)
  );
  return coincidencias.length === 1 ? coincidencias[0] : undefined;
}

/**
 * Los eventos agrupados por el día que ve el usuario, en orden de día.
 *
 * Vive aquí y no dentro de la página porque **la clave es el punto entero de este
 * fichero**: agrupar por `toISOString().slice(0, 10)` es agrupar por el día UTC, y
 * en Europe/Madrid la medianoche local son las 22:00 o las 23:00 del día
 * anterior. `scrapeSenderismo` emite exactamente eso —`new Date(y, m-1,
 * d).toISOString()`— así que con la clave UTC **todas las salidas de senderismo, y
 * todo evento entre las 00:00 y las 02:00, aparecían bajo el encabezado del día
 * anterior**: la página seleccionaba bien el mes, con getters locales, y luego
 * mostraba cada evento un día antes de la fecha que el usuario ve en la tarjeta.
 *
 * No es que el día estuviera mal en un sitio y bien en otro: `dedupeKey` de este
 * mismo fichero ya usa `localDateKey` desde hace tiempo, con un comentario que
 * explica por qué. Aquí la regla simplemente no se aplicó.
 *
 * Ordena las claves, y no confía en que le lleguen ordenadas. `aggregate` las
 * entrega por fecha, así que copiar ese orden sería dejar una precondición
 * invisible: el mismo grupo con la misma información saldría reordenado según quién
 * llame, y eso se descubre en la pantalla y no en un test. La clave es `YYYY-MM-DD`
 * —de ancho fijo y lexicográficamente creciente—, así que ordenar por cadena es
 * ordenar por fecha. Una fecha ilegible va a `"sin-fecha"`, que empieza por "s" y
 * queda al final.
 */
export function agruparPorDiaLocal(
  eventos: readonly AgendaEvento[]
): Map<string, AgendaEvento[]> {
  const porDia = new Map<string, AgendaEvento[]>();
  for (const ev of eventos) {
    const clave = localDateKey(ev.date);
    const grupo = porDia.get(clave);
    if (grupo) grupo.push(ev);
    else porDia.set(clave, [ev]);
  }
  return new Map([...porDia.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

export async function getEventoBySlug(
  slug: string
): Promise<{ evento: AgendaEvento; related: AgendaEvento[] } | null> {
  const eventos = await getAgendaEventos({ includePast: true });
  let evento = findBySlug(eventos, slug);

  // Alias persistente determinista (mismo tracking_id cambió de slug). Sin adivinar colisiones.
  if (!evento) {
    try {
      const alias = resolverAliasSlug(slug);
      if (alias) {
        evento = findBySlug(eventos, alias.canonical);
        if (!evento) {
          const archivado = getArchivedEventoBySlug(alias.canonical) ?? getArchivedEventoBySlug(slug);
          if (archivado) {
            const related: AgendaEvento[] = [];
            for (const ev of eventos) {
              if (related.length >= 6) break;
              if (new Date(ev.date) >= new Date()) related.push(ev);
            }
            return { evento: archivado, related };
          }
          const conocido = leerEstadoPorTrackingId(alias.tracking_id);
          if (conocido && conocido.estado !== "activo") {
            const fechaIso = conocido.fecha
              ? new Date(`${conocido.fecha}T12:00:00.000Z`).toISOString()
              : new Date().toISOString();
            const confirmado = conocido.estado === "ausencia_confirmada";
            const ultimaVez = conocido.ultima_vez
              ? new Date(conocido.ultima_vez).toISOString().slice(0, 10)
              : undefined;
            const ledgerEvento: AgendaEvento = {
              id: conocido.slug,
              slug: conocido.slug,
              title: conocido.title || "Evento con estado conocido",
              date: fechaIso,
              location: "Vitoria-Gasteiz",
              link: conocido.link || "",
              category: "Otros",
              source: conocido.source || "agenda",
              kind: "agenda",
              description: confirmado
                ? "Este evento ya no aparece en la fuente de origen tras varias comprobaciones sanas. Se muestra la última información conocida y su estado actual; no hay confirmación de que siga vigente."
                : "Este evento no se ha encontrado en la última importación sana de su fuente. Se muestra la última información conocida mientras se confirma su estado.",
              recoveredState: confirmado ? "retirado" : "archivado",
              provenance: confirmado
                ? `Estado confirmado por ausencias repetidas en importaciones sanas del registro${ultimaVez ? ` (visto por última vez: ${ultimaVez})` : ""}.`
                : `Ausencia detectada en importación sana; pendiente de confirmación${ultimaVez ? ` (visto por última vez: ${ultimaVez})` : ""}.`,
            };
            const related: AgendaEvento[] = [];
            for (const ev of eventos) {
              if (related.length >= 6) break;
              if (new Date(ev.date) >= new Date()) related.push(ev);
            }
            return { evento: ledgerEvento, related };
          }
        }
      }
    } catch {
      // El ledger no puede tumbar la resolución de detalle.
    }
  }

  if (!evento) {
    // 1) Recuperado/archivado manual (URL indexada conocida o programa añadido).
    const archivado = getArchivedEventoBySlug(slug);
    if (archivado) {
      const related: AgendaEvento[] = [];
      for (const ev of eventos) {
        if (related.length >= 6) break;
        if (new Date(ev.date) >= new Date()) related.push(ev);
      }
      return { evento: archivado, related };
    }

    // 2) Estado conocido en ledger: si el evento fue visto antes y ahora está
    // ausente confirmado/no confirmado en importaciones sanas, servimos la última
    // información conocida en vez de 404 ciego (página informativa con estado conocido).
    try {
      const conocido = leerEstadoPorSlug(slug);
      if (conocido && conocido.estado !== "activo") {
        const fechaIso = conocido.fecha
          ? new Date(`${conocido.fecha}T12:00:00.000Z`).toISOString()
          : new Date().toISOString();
        const confirmado = conocido.estado === "ausencia_confirmada";
        const ultimaVez = conocido.ultima_vez
          ? new Date(conocido.ultima_vez).toISOString().slice(0, 10)
          : undefined;
        const ledgerEvento: AgendaEvento = {
          id: conocido.slug,
          slug: conocido.slug,
          title: conocido.title || "Evento con estado conocido",
          date: fechaIso,
          location: "Vitoria-Gasteiz",
          link: conocido.link || "",
          category: "Otros",
          source: conocido.source || "agenda",
          kind: "agenda",
          description: confirmado
            ? "Este evento ya no aparece en la fuente de origen tras varias comprobaciones sanas. Se muestra la última información conocida y su estado actual; no hay confirmación de que siga vigente."
            : "Este evento no se ha encontrado en la última importación sana de su fuente. Se muestra la última información conocida mientras se confirma su estado.",
          recoveredState: confirmado ? "retirado" : "archivado",
          provenance: confirmado
            ? `Estado confirmado por ausencias repetidas en importaciones sanas del registro${ultimaVez ? ` (visto por última vez: ${ultimaVez})` : ""}.`
            : `Ausencia detectada en importación sana; pendiente de confirmación${ultimaVez ? ` (visto por última vez: ${ultimaVez})` : ""}.`,
        };
        const related: AgendaEvento[] = [];
        for (const ev of eventos) {
          if (related.length >= 6) break;
          if (new Date(ev.date) >= new Date()) related.push(ev);
        }
        return { evento: ledgerEvento, related };
      }
    } catch {
      // El ledger no puede tumbar la resolución de detalle.
    }
    return null;
  }

  const related: AgendaEvento[] = eventos.filter(
    (ev) =>
      ev.slug !== slug &&
      ev.category === evento.category &&
      new Date(ev.date) >= new Date()
  );

  if (related.length < 6) {
    for (const ev of eventos) {
      if (related.length >= 6) break;
      if (ev.slug !== slug && !related.includes(ev) && new Date(ev.date) >= new Date()) {
        related.push(ev);
      }
    }
  }

  return { evento, related };
}
