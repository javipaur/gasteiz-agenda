import * as cheerio from "cheerio";

const BASE_URL = "https://lagenterula.com";

export interface RulaEvent {
  title: string;
  date: string;
  image: string;
  location: string;
  link: string;
  description: string;
  category: string;
}

function inferCategory(title: string, description: string, url: string): string {
  const text = `${title} ${description} ${url}`.toLowerCase();
  if (/cine|pel[ií]cula|v\.?\s*o\.?\s*s\.?\s*e|jazzinema|cinef[oó]rum/.test(text)) return "Cine";
  if (/m[uú]sica|concierto|banda|d[uú]o|big band|[oó]rgano|swing|pop|rock/.test(text)) return "Música";
  if (/teatro|obra|escena|danza/.test(text)) return "Teatro";
  if (/exposici[oó]n|museo|arte|goya/.test(text)) return "Exposiciones";
  if (/infantil|niños?|niñas?/.test(text)) return "Infantil";
  if (/visita.*guiada|patrimonio/.test(text)) return "Visitas";
  if (/conferencia|charla|presentaci[oó]n|literatura|poes[ií]a|libro/.test(text)) return "Conferencias";
  if (/senderismo|rutas?|montaña/.test(text)) return "Senderismo";
  return "Otros";
}

export async function scrapeRula(): Promise<RulaEvent[]> {
  const res = await fetch(BASE_URL, {
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(15000),
  });
  const html = await res.text();
  const $ = cheerio.load(html);

  const events: RulaEvent[] = [];
  const seenUrls = new Set<string>();

  $('script[type="application/ld+json"]').each((_, script) => {
    try {
      const data = JSON.parse($(script).text());
      if (data["@type"] !== "Event") return;

      const url = data.url || "";
      if (!url || seenUrls.has(url)) return;
      seenUrls.add(url);

      const title = data.name || "";
      if (!title) return;

      const date = data.startDate || "";
      const image = data.image || "";
      const location = data.location?.name || "";
      const address = data.location?.address || "";
      const description = data.description || "";
      const locationStr = location ? (address ? `${location}, ${address}` : location) : "Vitoria-Gasteiz";

      const category = inferCategory(title, description, url);

      events.push({
        title,
        date,
        image,
        location: locationStr,
        link: url,
        description,
        category,
      });
    } catch {}
  });

  return events;
}
