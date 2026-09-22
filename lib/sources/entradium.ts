import * as cheerio from "cheerio";

export interface EntradiumEvent {
  title: string;
  date: string;
  image: string;
  location: string;
  link: string;
  price: string;
}

const HOME_URL = "https://m.entradium.com/es";
const USER_AGENT_MOBILE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const MONTHS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

function strip(value: string): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function parseDate(label: string): string {
  // "Varias fechas": evento recurrente en curso → se fija al día actual
  if (/varias\s*(fechas?|d[ií]as)|several dates/i.test(label)) {
    return new Date().toISOString().slice(0, 10);
  }

  // Formato visto: "26 sep" (año actual salvo fechas ya pasadas)
  const year = new Date().getFullYear();
  const m = label.toLowerCase().match(/(\d{1,2})\s*(?:de\s*)?([a-z]{2,})/i);
  if (!m) return "";

  const day = parseInt(m[1], 10);
  const monthStr = m[2].slice(0, 3).replace(/\.$/, "");
  const monthIdx = MONTHS.indexOf(monthStr);
  if (!day || monthIdx === -1) return "";

  const month = monthIdx + 1;
  const date = new Date(year, month - 1, day);
  // Si ya pasó (salvo enero/diciembre cerca del fin de año) asumo año siguiente
  if (date.getTime() < Date.now() && month >= 6) {
    date.setFullYear(year + 1);
  }
  return date.toISOString().slice(0, 10);
}

export async function scrapeEntradium(): Promise<EntradiumEvent[]> {
  const res = await fetch(HOME_URL, {
    headers: { "User-Agent": USER_AGENT_MOBILE },
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) {
    console.error(`Entradium returned ${res.status}`);
    return [];
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const events: EntradiumEvent[] = [];
  const today = new Date().toISOString().slice(0, 10);

  $("a.event-card").each((_, el) => {
    const card = $(el);
    const title = strip(card.find(".event-title").first().text());
    if (!title) return;

    const link = card.attr("href") || "";
    const fullLink = link.startsWith("http")
      ? link
      : new URL(link, "https://m.entradium.com").toString();

    const image = card.find("picture img").attr("srcset")?.split("?")[0] || "";

    const dateLabel = strip(card.find(".date span").first().text());
    const date = parseDate(dateLabel);
    if (!date || date < today) return;

    const venue = strip(card.find(".event-venue").first().text());
    // Sólo eventos en Vitoria-Gasteiz
    if (!/vitoria[- ]gasteiz/i.test(venue)) return;

    const price = strip(card.find(".price").text().replace(/^Desde/, ""));

    events.push({
      title,
      date,
      image,
      location: venue,
      link: fullLink,
      price,
    });
  });

  // Si la home móvil no listó eventos, fallback a la home de escritorio (más densa)
  if (events.length === 0) {
    const desktop = await fetch("https://entradium.com/es", {
      headers: { "User-Agent": USER_AGENT_MOBILE },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(25000),
    });
    if (desktop.ok) {
      const $d = cheerio.load(await desktop.text());
      $d("a.event-card").each((_, el) => {
        const card = $d(el);
        const title = strip(card.find(".event-title").first().text());
        if (!title) return;

        const link =
          card.attr("href") && !card.attr("href")!.startsWith("http")
            ? `https://entradium.com${card.attr("href")}`
            : card.attr("href") || "";
        const dateLabel = strip(card.find(".date span").first().text());
        const date = parseDate(dateLabel);
        if (!date || date < today) return;

        const venue = strip(card.find(".event-venue").first().text());
        if (!/vitoria[- ]gasteiz/i.test(venue)) return;

        events.push({
          title,
          date,
          image: card.find("picture img").attr("srcset")?.split("?")[0] || "",
          location: venue,
          link,
          price: strip(card.find(".price").text().replace(/^Desde/, "")),
        });
      });
    }
  }

  return events;
}