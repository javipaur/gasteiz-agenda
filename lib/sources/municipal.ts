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
  image?: string;
  location: string;
  link: string;
  category?: string;
  source?: string;
  description?: string;
  time?: string;
};

function normalizeEvento(evento: any): MunicipialEvento {
  const extractedPicture = extractSrcsetFromPicture(evento.picture);
  const image =
    transformImageUrl(evento.imagen) ||
    transformImageUrl(extractedPicture ?? undefined);
  const fullImage = image ? "https://www.vitoria-gasteiz.org".concat(image) : undefined;
  return {
    id: evento.codigo || crypto.randomUUID(),
    title: evento.titulo ?? "",
    date: evento.datetime ?? evento.fechaInicio ?? "",
    image: fullImage,
    location: evento.localizacion ?? evento.dirUbicacion ?? "",
    link: evento.url ?? evento.linkDetalle ?? "",
  };
}

export async function scrapeMunicipalCalendar(options?: {
  calendariosID?: number;
  tipo?: (number | string)[];
  dest?: string[];
  fd?: number;
  fh?: number;
}): Promise<MunicipialEvento[]> {
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

  let filterParts: string[] = [];
  if (options?.tipo) filterParts.push(`"tipo":${JSON.stringify(options.tipo)}`);
  if (options?.dest) filterParts.push(`"dest":${JSON.stringify(options.dest)}`);
  const filterStr = filterParts.length > 0 ? `&f={${filterParts.join(",")}}` : "";

  const url = `${MUNICIPAL_BASE}?accion=buscar&idioma=es&calendariosID=${calendariosID}&fd=${fd}&fh=${fh}&deCM=false&moEx=false${filterStr}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();

  const eventos: MunicipialEvento[] = Object.values(data || {})
    .reduce((acc: any[], seccion: any) => {
      if (seccion?.resultados) acc.push(...seccion.resultados);
      return acc;
    }, [])
    .map(normalizeEvento);

  return eventos;
}
