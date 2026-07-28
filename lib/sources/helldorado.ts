import * as cheerio from "cheerio";

const API_BASE = "https://helldorado.net/wp-json/wp/v2/evento";

const ES_MONTHS: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};

function parseSpanishDate(text: string): string | null {
  const m = text.match(/(\d{1,2})\s+de\s+(\w+)(?:\s+de\s+(\d{4}))?/i);
  if (!m) {
    const m2 = text.match(/(\d{1,2})\s+(\w+)/i);
    if (!m2) return null;
    const day = parseInt(m2[1], 10);
    const monthIdx = ES_MONTHS[m2[2].toLowerCase()];
    if (monthIdx === undefined) return null;
    const year = new Date().getFullYear();
    return `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const day = parseInt(m[1], 10);
  const monthIdx = ES_MONTHS[m[2].toLowerCase()];
  if (monthIdx === undefined) return null;
  const year = m[3] ? parseInt(m[3], 10) : new Date().getFullYear();
  return `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export interface HelldoradoEvent {
  title: string;
  date: string;
  image: string;
  location: string;
  link: string;
  description: string;
}

async function scrapeEventPage(url: string): Promise<{ date: string; image: string; description: string }> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 86400 },
    });
    if (!res.ok) return { date: "", image: "", description: "" };
    const html = await res.text();
    const $ = cheerio.load(html);

    const dateText = $(".elementor-element-81becb8 .elementor-heading-title").text().trim();
    const date = parseSpanishDate(dateText) || "";

    const img = $(".elementor-element-6a1c479 img").first().attr("src") || "";
    const image = img.startsWith("http") ? img : img ? `https://helldorado.net${img}` : "";

    const desc = $(".elementor-element-6ee8671 .elementor-widget-text-editor").text().trim().slice(0, 200);

    return { date, image, description: desc };
  } catch {
    return { date: "", image: "", description: "" };
  }
}

export async function scrapeHelldorado(): Promise<HelldoradoEvent[]> {
  const today = new Date().toISOString().slice(0, 10);
  const allEvents: { slug: string; title: string; link: string; postDate: string }[] = [];

  for (let page = 1; page <= 5; page++) {
    try {
      const res = await fetch(`${API_BASE}?per_page=50&page=${page}&orderby=date&order=desc&_fields=id,slug,title,link,date`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(15000),
        next: { revalidate: 3600 },
      });
      if (!res.ok) break;
      const data: any[] = await res.json();
      if (!data.length) break;
      allEvents.push(...data.map((e) => ({
        slug: e.slug,
        title: e.title?.rendered || "",
        link: e.link || "",
        postDate: (e.date || "").slice(0, 10),
      })));
      const totalPages = parseInt(res.headers.get("X-WP-TotalPages") || "1", 10);
      if (page >= totalPages) break;
    } catch {
      break;
    }
  }

  const futureEvents = allEvents.filter((e) => e.postDate >= today || !e.postDate);
  const toScrape = futureEvents.slice(0, 40);

  const scraped = await Promise.allSettled(
    toScrape.map(async (e) => {
      const { date, image, description } = await scrapeEventPage(e.link);
      return {
        title: e.title,
        date: date || e.postDate,
        image,
        location: "Helldorado",
        link: e.link,
        description,
      };
    })
  );

  return scraped
    .filter((r): r is PromiseFulfilledResult<HelldoradoEvent> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((e) => e.title && e.date);
}
