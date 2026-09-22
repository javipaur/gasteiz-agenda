import * as cheerio from "cheerio";

export interface MunicipalEvent {
  title: string;
  link: string;
  date: string;
  description: string;
  category: string;
}

const RSS_URLS = {
  cultural:
    "https://www.vitoria-gasteiz.org/wb021/was/rssAction.do?idioma=es&accion=actividadesCuadroMando&claveTema=&claveArea=38",
  deportiva:
    "https://www.vitoria-gasteiz.org/wb021/was/rssAction.do?idioma=es&accion=actividadesCuadroMando&claveTema=&claveArea=34",
};

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

// Uso real: los ítems llevan <title>, <link> y <dc:date> (o <pubDate>).
// No hay </description> por ítem así que la descripción se deja vacía.
function parseRss(xml: string, category: string): MunicipalEvent[] {
  if (!xml?.trim()) return [];
  const $ = cheerio.load(xml, { xmlMode: true });
  const events: MunicipalEvent[] = [];

  $("item").each((_, el) => {
    const item = $(el);
    const title = item.find("title").first().text().trim();
    if (!title) return;

    const link = item.find("link").first().text().trim();
    const dcDate = item.find("dc\\:date").first().text().trim();
    const pubDate = item.find("pubDate").first().text().trim();
    const dateRaw = dcDate || pubDate;

    const date = dateRaw
      ? new Date(dateRaw).toISOString().slice(0, 10)
      : "";

    events.push({ title, link, date, description: "", category });
  });

  return events;
}

export async function scrapeMunicipalRss(): Promise<MunicipalEvent[]> {
  const today = new Date().toISOString().slice(0, 10);
  const all: MunicipalEvent[] = [];

  for (const [category, url] of Object.entries(RSS_URLS)) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) {
        console.error(`Municipal RSS (${category}) returned ${res.status}`);
        continue;
      }
      const xml = await res.text();
      const events = parseRss(xml, category);
      for (const e of events) {
        if (e.date >= today) all.push(e);
      }
    } catch (err) {
      console.error(`Municipal RSS (${category}) error:`, err);
    }
  }

  return all;
}