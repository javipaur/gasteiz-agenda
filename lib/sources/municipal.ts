const MUNICIPAL_BASE = "https://www.vitoria-gasteiz.org/wb021/was/CalendarioServlet";

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

  const url = `${MUNICIPAL_BASE}?accion=buscar&idioma=es&calendariosID=${calendariosID}&fd=${fd}&fh=${fh}&deCM=false&moEx=false${filterStr}`;

  const res = await fetch(url, {
    cache: "no-store",
    // El timeout no es decoración: se lo trae `scrapeFiestasBlanca`, que pedía el
    // calendario 27 veces seguidas y se colgaba en cuanto una no respondía. Al
    // mover el fetch aquí, ponerlo cubre las diez entradas municipales en vez de
    // solo una.
    signal: AbortSignal.timeout(20000),
  });
  // Propaga, y no devuelve `[]`. Un `return []` aquí se comía el fallo entero:
  // `lib/agenda.ts` usa `Promise.allSettled`, así que una fuente que **resuelve**
  // con lista vacía es indistinguible de una que no publica nada, y su
  // `logger.warn("scraping_failed")` solo se dispara en las promesas que
  // **rechazan**. Con `priority: 0` —la que gana todos los dedupes— eso dejaba la
  // agenda municipal vacía, cacheada 5 min en `agenda-all`, con HTTP 200 y sin
  // una sola línea de log. Rechazando, el 502 llega al panel como
  // `scraping_failed` y el resto de la agenda sigue saliendo, que es justo lo que
  // `Promise.allSettled` garantiza para las demás.
  //
  // El patrón es el de `buscametas.ts:55`, y el estado va en el mensaje porque
  // `agenda.ts:107` loguea `reason.message` y nada más: sin él, un 502 y un 404
  // son la misma línea.
  if (!res.ok) {
    throw new Error(`municipal calendar returned ${res.status}`);
  }
  const data = await res.json();

  return Object.values(data || {})
    .reduce((acc: any[], seccion: any) => {
      if (seccion?.resultados) acc.push(...seccion.resultados);
      return acc;
    }, []);
}

export async function scrapeMunicipalCalendar(
  options?: MunicipalQuery
): Promise<MunicipialEvento[]> {
  const crudos = await fetchMunicipalCalendar(options);
  return crudos.map(normalizeEvento);
}
