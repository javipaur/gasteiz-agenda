import * as cheerio from "cheerio";

export interface EventbriteEvent {
  title: string;
  date: string;
  image: string;
  location: string;
  link: string;
  description: string;
  price: string;
}

const CITY_URL = "https://www.eventbrite.es/d/spain--vitoria-gasteiz/events/";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

interface LdEvent {
  name?: string;
  startDate?: string;
  url?: string;
  image?: string;
  location?: {
    address?: { addressLocality?: string; addressRegion?: string };
    name?: string;
  };
}

function strip(value: string): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

export async function scrapeEventbrite(): Promise<EventbriteEvent[]> {
  const res = await fetch(CITY_URL, {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) {
    console.error(`Eventbrite returned ${res.status}`);
    return [];
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const events: EventbriteEvent[] = [];
  const today = new Date().toISOString().slice(0, 10);

  // JSON-LD embebido por el lister de SEO de Eventbrite
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text().trim();
    if (!raw) return;

    const json = (() => {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    })();

    const items: LdEvent[] = Array.isArray(json?.itemListElement)
      ? json.itemListElement
          .map((item: { item?: LdEvent }) => item?.item)
          .filter(Boolean)
      : json && json["@type"] === "Event"
        ? [json]
        : [];

    for (const ev of items) {
      const locality =
        ev.location?.address?.addressLocality || "";
      // Sólo eventos dentro de Vitoria-Gasteiz
      if (!/vitoria[- ]gasteiz/i.test(locality)) continue;

      const date = ev.startDate || "";
      if (!date || date.slice(0, 10) < today) continue;

      events.push({
        title: strip(ev.name || ""),
        date: date.slice(0, 10),
        image: ev.image || "",
        location: strip(ev.location?.name || locality),
        link: ev.url || CITY_URL,
        description: "",
        price: "",
      });
    }
  });

  return events.filter((e) => e.title);
}