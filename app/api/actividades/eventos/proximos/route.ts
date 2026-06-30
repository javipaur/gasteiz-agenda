import { NextResponse } from "next/server";

const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map<string, { data: any[]; timestamp: number }>();

function normalizeEvento(e: any) {
  return {
    id: e.id || crypto.randomUUID(),
    title: e.title || "Sin título",
    date: e.date || e.startDate || "",
    image: e.image?.startsWith("http") ? e.image : null,
    location: e.location || e.place || "Vitoria-Gasteiz",
    link: e.link || "",
    category: e.category || "",
    source: e.source || "desconocido",
    time: e.time || "",
    description: e.description || "",
  };
}

async function fetchSource(url: string, sourceName: string): Promise<any[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(url, { signal: controller.signal, next: { revalidate: 3600 } });
    clearTimeout(timeout);
    if (!res.ok) return [];
    const json = await res.json();
    const items: any[] = json?.data || json?.eventos || (Array.isArray(json) ? json : []);
    return items.map((e) => normalizeEvento({ ...e, source: sourceName }));
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const startDateParam = searchParams.get("startDate") || searchParams.get("date");
  const endDateParam = searchParams.get("endDate");

  const cacheKey = "proximos";
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    let result = cached.data;
    if (startDateParam) {
      const filterStart = new Date(startDateParam);
      if (!isNaN(filterStart.getTime())) {
        const filterEnd = endDateParam ? new Date(endDateParam) : new Date(filterStart);
        filterEnd.setHours(23, 59, 59, 999);
        result = result.filter((e) => {
          const d = new Date(e.date);
          return d >= filterStart && d <= filterEnd;
        });
      }
    }
    return NextResponse.json({ data: result });
  }

  const results = await Promise.allSettled([
    fetchSource(`${origin}/api/fever`, "fever"),
    fetchSource(`${origin}/api/rula`, "rula"),
    fetchSource(`${origin}/api/gasteizhoy`, "gasteizhoy"),
    fetchSource(`${origin}/api/vam`, "vam"),
    (async () => {
      const municipUrl = "https://www.vitoria-gasteiz.org/wb021/was/CalendarioServlet";
      try {
        const hoy = new Date();
        const inicio = new Date(hoy);
        inicio.setHours(0, 0, 0, 0);
        const fin = new Date(hoy);
        fin.setDate(fin.getDate() + 60);
        fin.setHours(23, 59, 59, 999);
        const fd = inicio.getTime();
        const fh = fin.getTime();
        const res = await fetch(
          `${municipUrl}?accion=buscar&idioma=es&claveArea=&claveTema=&calendariosID=196&t=&fd=${fd}&fh=${fh}&deCM=false&moEx=false`,
          { next: { revalidate: 3600 } }
        );
        if (!res.ok) return [];
        const data = await res.json();
        const items: any[] = data?.resultados || [];
        const tipoMap: Record<string, string> = {
          "2": "Música",
          "6": "Eventos",
          "7": "Exposiciones",
          "13": "Teatro",
        };
        return items.map((e: any) => ({
          id: e.codigo || crypto.randomUUID(),
          title: e.titulo || "Sin título",
          date: e.fechaInicio || null,
          image: e.imagenDestacada?.startsWith("http")
            ? e.imagenDestacada
            : e.imagenDestacada
              ? `https://www.vitoria-gasteiz.org${e.imagenDestacada}`
              : null,
          location: e.dirUbicacion || "Vitoria-Gasteiz",
          link: e.linkDetalle || e.url || "",
          category: tipoMap[e.tipo] || e.tipo || "Eventos",
          source: "vitoria-gasteiz",
          description: e.descripcion || e.resumen || "",
          time: "",
        }));
      } catch {
        return [];
      }
    })(),
    (async () => {
      const eusUrl = "https://api.euskadi.eus/culture/events/v1.0/events/upcoming?_elements=20&_page=1&municipalityNoraCode=46&provinceNoraCode=1";
      try {
        const res = await fetch(eusUrl, { next: { revalidate: 3600 } });
        if (!res.ok) return [];
        const data = await res.json();
        const items: any[] = data?.items || [];
        return items.map((e: any) => ({
          id: e.id || crypto.randomUUID(),
          title: e.nameEs?.trim() || "Sin título",
          date: e.startDate?.trim() || null,
          image: e?.images?.length ? e.images[0].imageUrl : null,
          location: e.establishmentEs || "Desconocido",
          link: e.sourceUrlEs?.startsWith("http") ? e.sourceUrlEs : "",
          category: e.typeEs?.toLowerCase()?.trim() || "evento",
          source: "euskadi",
        }));
      } catch {
        return [];
      }
    })(),
  ]);

  const allEvents: any[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      allEvents.push(...result.value);
    }
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const seen = new Set<string>();
  const deduped = allEvents
    .filter((e) => {
      const fecha = new Date(e.date);
      return !isNaN(fecha.getTime()) && fecha >= hoy;
    })
    .filter((e) => {
      const key = `${e.title}|${e.date}`.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  cache.set(cacheKey, { data: deduped, timestamp: now });

  let result = deduped;
  if (startDateParam) {
    const filterStart = new Date(startDateParam);
    if (!isNaN(filterStart.getTime())) {
      const filterEnd = endDateParam ? new Date(endDateParam) : new Date(filterStart);
      filterEnd.setHours(23, 59, 59, 999);
      result = result.filter((e) => {
        const d = new Date(e.date);
        return d >= filterStart && d <= filterEnd;
      });
    }
  }

  return NextResponse.json({ data: result });
}
