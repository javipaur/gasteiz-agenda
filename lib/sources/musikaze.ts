import * as cheerio from "cheerio";

const BASE_URL = "https://entradas.musikaze.com/web/";
const SITE_ID = "tickets";

const ES_MONTHS: Record<string, number> = {
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
  jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11,
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};

function parseMusikazeDate(weekday: string, day: string, month: string, year: string): string {
  const monthIdx = ES_MONTHS[month.toLowerCase().replace(".", "")];
  if (monthIdx === undefined) return "";
  const y = parseInt(year, 10) || new Date().getFullYear();
  return `${y}-${String(monthIdx + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function extractTicketLink($el: any): string {
  const btn = $el.find("button.btn-info").first();
  const onClick = btn.attr("onclick") || "";
  const jsMatch = onClick.match(/JS_Src\([^,]+,\s*'([^']+)'/);
  if (jsMatch) return jsMatch[1];

  const linkBtn = $el.find("a.btn-info").first();
  const href = linkBtn.attr("href");
  if (href && href !== "#") return href;

  return "";
}

export interface MusikazeEvent {
  title: string;
  date: string;
  image: string;
  location: string;
  link: string;
  description: string;
}

async function scrapePage(page: number): Promise<MusikazeEvent[]> {
  const url = `${BASE_URL}?menu=36&pagina=conciertos&siteID=${SITE_ID}&filtrarEvtMskzLoc=VITORIA-GASTEIZ,ok&pag=${page}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(20000),
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];

  const html = await res.text();
  const $ = cheerio.load(html);
  const events: MusikazeEvent[] = [];

  $("article.mkp-ticket-item").each((_, el) => {
    const $el = $(el);
    const title = $el.find(".mkp-ticket-data-title").text().trim();
    const weekday = $el.find(".mkp-ticket-date-weekday").text().trim();
    const day = $el.find(".mkp-ticket-date-monthday").text().trim();
    const month = $el.find(".mkp-ticket-date-month").text().trim();
    const year = $el.find(".mkp-ticket-date-year").text().trim();
    const place = $el.find(".mkp-ticket-data-place").text().trim();
    const imgSrc = $el.find(".mkp-ticket-image img").attr("src") || "";
    const image = imgSrc ? `https://entradas.musikaze.com${imgSrc}` : "";
    const link = extractTicketLink($el);

    const date = parseMusikazeDate(weekday, day, month, year);

    if (title) {
      events.push({
        title,
        date,
        image,
        location: place || "Vitoria-Gasteiz",
        link,
        description: "",
      });
    }
  });

  return events;
}

export async function scrapeMusikaze(): Promise<MusikazeEvent[]> {
  const page1 = await scrapePage(1);
  const events = [...page1];

  if (page1.length >= 50) {
    const page2 = await scrapePage(2);
    events.push(...page2);
  }

  const today = new Date().toISOString().slice(0, 10);
  return events.filter((e) => e.date >= today && e.title);
}
