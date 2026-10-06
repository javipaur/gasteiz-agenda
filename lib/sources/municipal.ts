import { localDateKey } from "../slug";

const MUNICIPAL_BASE = "https://www.vitoria-gasteiz.org/wb021/was/CalendarioServlet";

/**
 * Filas a partir de las cuales la respuesta se da por truncada.
 *
 * **El tope del servlet no es un número único, y por eso el umbral no busca el
 * tope.** Medido el 6 de octubre de 2026: una consulta con `tipo` devuelve 50 o 54
 * según el tipo, y la consulta sin filtro —`municipal-general`— devolvió 120 de una
 * vez. El corte va por sección, no por petición.
 *
 * 45 está por debajo de cualquiera de los dos topes. La consecuencia aceptada es que
 * `municipal-general` se pagina siempre: doce peticiones más para la única entrada
 * que ve todos los tipos a la vez. La alternativa sería un umbral por entrada, y un
 * umbral por entrada es una lista mantenida a mano que se pudre el día que el
 * Ayuntamiento añada un tipo, que es lo que pasó dos veces esta semana.
 */
const FILAS_SOSPECHOSAS = 45;

/**
 * La ventana más estrecha que se pide: medio mes, que es lo que sale de partir un mes
 * por la mitad.
 *
 * No es un número redondo porque no tiene por qué serlo: los meses van de 28 a 31 días
 * y sus mitades de 14 a 16, así que 16 es el suelo del grano y por debajo se devuelve
 * lo que vino. También evita que se repita la misma ventana: `ventanasDeMes` sobre una
 * ventana de menos de un mes devuelve esa ventana entera, así que sin este suelo una
 * consulta de dos semanas pediría sus mismos días dos veces.
 */
const GRANO_MINIMO_DIAS = 16;

/** Las ventanas de un mes que cubren `[fd, fh]`. El último mes se recorta a `fh`. */
function ventanasDeMes(fd: number, fh: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const d = new Date(fd);
  while (d.getTime() < fh) {
    const hasta = new Date(d);
    hasta.setMonth(hasta.getMonth() + 1);
    out.push([d.getTime(), Math.min(hasta.getTime(), fh)]);
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

/**
 * Una ventana del calendario, y si viene llena, sus trozos.
 *
 * **La cota son dos particiones, meses y medios meses.** La ventana que se pide va
 * primero; si viene llena —45 filas o más— se repite mes a mes; y si un mes viene
 * lleno, ese mes se parte por la mitad. El peor caso son **38 peticiones** por entrada,
 * medido: la ventana de un año, doce meses que se parten en tres cada uno, y el resto
 * final de un día que no llega a partirse porque ya es más corto que medio mes. El caso
 * normal son **14**, porque el segundo nivel solo se dispara si un mes trae 45 filas del
 * mismo tipo o más, y eso no se ha visto: el tipo más lleno del calendario medido el 6 de
 * octubre de 2026 trae 157 al año, o sea unos trece al mes. El coste del segundo nivel se
 * paga, por tanto, **solo cuando se dispara**, que es lo que lo hace aceptable.
 *
 * Lo que se acepta como peaje de esa cota es truncar ese mes en silencio, que es
 * exactamente la clase de fallo que la paginación vino a arreglar. La otra forma de no
 * truncar es avisar, así que el segundo nivel avisa por consola antes de dispararse: si
 * el aviso salta, hay que mirar por qué un mes trae 45 cosas de un mismo tipo.
 */
async function pedirVentana(
  fd: number,
  fh: number,
  filterStr: string,
  profundidad: number,
  calendariosID: number
): Promise<any[]> {
  const url = `${MUNICIPAL_BASE}?accion=buscar&idioma=es&calendariosID=${calendariosID}&fd=${fd}&fh=${fh}&deCM=false&moEx=false${filterStr}`;
  // El timeout no es decoración: se lo trae `scrapeFiestasBlanca`, que pedía el
  // calendario 27 veces seguidas y se colgaba en cuanto una no respondía. Al
  // mover el fetch a este módulo, ponerlo cubre las diez entradas municipales
  // en vez de solo una. Y ahora cubre también las trece peticiones de paginación
  // de cada una.
  //
  // Y de 20 s a 45 s, medido, no por prudencia. Con diez variantes eran 20; con
  // las dieciséis que hay ahora son **dieciséis peticiones al mismo servlet
  // lanzadas en paralelo**, todas con el mismo `fd`/`fh`, y la más lenta se queda
  // al borde del plazo. Cuatro arranques en frío seguidos el 5 de octubre de 2026
  // tardaron 5,6 s, 19,7 s, 5,8 s y 6,1 s: tres bien y **una a 400 ms de cortar**,
  // que es exactamente la forma que tiene de cruzarse. Y cuando se cruzó, el
  // efecto no fue un scraper lento: fueron quince fuentes fuera y
  // `completa: false` en `/api/v1/salud`, porque un `AbortSignal` agotado rechaza
  // la promesa y `aggregate` marca las que rechazan.
  //
  // Subir el plazo y no bajar el número de peticiones porque el coste de equivocarse
  // no es el mismo: un arranque en frío lento se cachea cinco minutos y las páginas
  // son ISR, mientras que un timeout deja huecos en la agenda sin log de error. Y
  // la paginación es la razón por la que subirlo no basta: 1 + 13 por entrada son
  // doscientas y pico peticiones al mismo servlet, y por eso el segundo nivel de
  // partición no se abre ni aunque una ventana de un mes venga llena.
  const res = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(45000),
  });

  // Propaga, y no devuelve `[]`. Un `return []` aquí se comería el fallo entero:
  // `lib/agenda.ts` usa `Promise.allSettled`, así que una fuente que resuelve con
  // lista vacía es indistinguible de una que no publica nada, y el `logger.warn` solo
  // se dispara en las promesas que rechazan. Con `priority: 0` —la que gana todos los
  // dedupes— eso dejaba la agenda municipal vacía, cacheada, con HTTP 200 y sin una
  // sola línea de log.
  //
  // El patrón es el de `buscametas.ts:55`, y el estado va en el mensaje porque
  // `agenda.ts:107` loguea `reason.message` y nada más: sin él, un 502 y un 404
  // son la misma línea.
  if (!res.ok) {
    throw new Error(`municipal calendar returned ${res.status}`);
  }

  const data = await res.json();
  const eventos = Object.values(data || {}).reduce((acc: any[], seccion: any) => {
    if (seccion?.resultados) acc.push(...seccion.resultados);
    return acc;
  }, []);

  if (eventos.length < FILAS_SOSPECHOSAS) return eventos;

  const dias = (fh - fd) / 86400000;

  // El tope son dos particiones —meses y medios meses— y el grano mínimo es medio mes,
  // que es donde para la segunda. Por debajo de medio mes no hay subdivisión que
  // valga: se devuelve lo que vino aunque siga truncado, porque partir más solo
  // multiplica peticiones contra un servlet que ya devolvió 45 filas.
  if (profundidad >= 2 || dias < GRANO_MINIMO_DIAS) return eventos;

  if (profundidad === 0) {
    const trozos: any[] = [];
    for (const [desde, hasta] of ventanasDeMes(fd, fh)) {
      trozos.push(...(await pedirVentana(desde, hasta, filterStr, 1, calendariosID)));
    }
    return trozos;
  }

  // El estado va dentro del texto, no se queda en la cuenta. Es el mismo patrón que el
  // `throw` de arriba y por el mismo motivo: `lib/agenda.ts:107` loguea
  // `reason.message` y nada más, así que un aviso sin calendario ni rango no dice
  // dónde mirar.
  console.warn(
    `municipal calendar truncado: calendariosID=${calendariosID} ` +
      `${localDateKey(new Date(fd).toISOString())}..${localDateKey(new Date(fh).toISOString())} ` +
      `devuelve ${eventos.length} filas en ${Math.round(dias)} días (> ${FILAS_SOSPECHOSAS}), ` +
      `se parte por la mitad`
  );

  const mitad = Math.floor(fd + (fh - fd) / 2);
  const [primera, segunda] = await Promise.all([
    pedirVentana(fd, mitad, filterStr, 2, calendariosID),
    pedirVentana(mitad, fh, filterStr, 2, calendariosID),
  ]);
  return [...primera, ...segunda];
}

function extractSrcsetFromPicture(picture: string): string | null {
  if (!picture) return null;
  const webp = picture.match(
    /<source[^>]+type=['"]image\/webp['"][^>]+srcset=['"]([^'"]+)['"]/
  );
  if (webp) return webp[1];
  const jpeg = picture.match(
    /<source[^>]+type=['"]image\/jpeg['"][^>]+srcset=['"]([^'"]+)['"]/
  );
  if (jpeg) return jpeg[1];
  return null;
}

function transformImageUrl(url?: string): string | null {
  if (!url) return null;
  return url.replace(/_smart\.(webp|jpg|jpeg)$/i, "_smar.jpg");
}

export type MunicipialEvento = {
  id: string;
  title: string;
  date: string;
  dateEnd?: string;
  image?: string;
  location: string;
  link: string;
  category?: string;
  source?: string;
  description?: string;
  time?: string;
  cancelled?: boolean;
};

const GENERIC_AUDIENCES = ["todos los públicos", "público general", "todos"];

function normalizeFecha(yyyymmdd?: string | null): string | undefined {
  if (!yyyymmdd) return undefined;
  const m = String(yyyymmdd).match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
}

function normalizeEvento(evento: any): MunicipialEvento {
  const extractedPicture = extractSrcsetFromPicture(evento.picture);
  const image =
    transformImageUrl(evento.imagen) ||
    transformImageUrl(extractedPicture ?? undefined);
  const fullImage = image ? "https://www.vitoria-gasteiz.org".concat(image) : undefined;

  const audience = (evento.destinatario ?? "").trim();
  const description =
    audience && !GENERIC_AUDIENCES.includes(audience.toLowerCase())
      ? audience
      : undefined;

  return {
    id: evento.codigo || crypto.randomUUID(),
    title: evento.titulo ?? "",
    date: evento.datetime ?? evento.fechaInicio ?? "",
    dateEnd: normalizeFecha(evento.fechaFin),
    image: fullImage,
    location: evento.localizacion ?? evento.dirUbicacion ?? "",
    link: evento.url ?? evento.linkDetalle ?? "",
    description,
    time: evento.horaInicio?.trim() || undefined,
    cancelled: evento.isCancelado || undefined,
  };
}
export type MunicipalQuery = {
  calendariosID?: number;
  tipo?: (number | string)[];
  dest?: string[];
  fd?: number;
  fh?: number;
};

/**
 * Los resultados crudos de `CalendarioServlet`, sin normalizar.
 *
 * Vive separado de `scrapeMunicipalCalendar` porque no todo el mundo que consulta
 * el calendario municipal quiere el mismo tipo de evento. La agenda pide el
 * calendario por `tipo` y su normalización; La Blanca pide `calendariosID=513` y
 * trae su propio `mapEvent`, porque sus consumidores leen `dateEnd`, `timeEnd`,
 * `target` y `dayWeek`, que `MunicipialEvento` no tiene. Antes las dos rutas
 * montaban la URL y aplanaban las secciones por su cuenta, con lo que una cambio
 * en la forma de la respuesta había que hacerlo dos veces.
 *
 * El rango por defecto es de hoy a dentro de un año, así que una consulta de
 * calendario no necesita que quien la llama le pase fechas.
 */
export async function fetchMunicipalCalendar(
  options?: MunicipalQuery
): Promise<any[]> {
  const hoy = new Date();
  const inicio = new Date(hoy);
  inicio.setHours(0, 0, 0, 0);

  const fin = options?.fh
    ? new Date(options.fh)
    : new Date(hoy.getFullYear() + 1, hoy.getMonth(), hoy.getDate());
  fin.setHours(23, 59, 59, 999);

  const fd = options?.fd ?? inicio.getTime();
  const fh = options?.fh ?? fin.getTime();
  const calendariosID = options?.calendariosID ?? 196;

  const filterParts: string[] = [];
  if (options?.tipo) filterParts.push(`"tipo":${JSON.stringify(options.tipo)}`);
  if (options?.dest) filterParts.push(`"dest":${JSON.stringify(options.dest)}`);
  const filterStr = filterParts.length > 0 ? `&f={${filterParts.join(",")}}` : "";

  return pedirVentana(fd, fh, filterStr, 0, calendariosID);
}

export async function scrapeMunicipalCalendar(
  options?: MunicipalQuery
): Promise<MunicipialEvento[]> {
  const crudos = await fetchMunicipalCalendar(options);
  return crudos.map(normalizeEvento);
}
