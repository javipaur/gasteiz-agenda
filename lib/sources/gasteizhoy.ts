import * as cheerio from "cheerio";
import { fetchOgImage } from "@/lib/og-image";

const BASE_URL = "https://www.gasteizhoy.com/ociogasteiz/";

export interface GasteizHoyEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  image: string;
  location: string;
  link: string;
  description: string;
  category: string;
  source: string;
}

function inferCategory(title: string, description: string): string {
  const text = `${title} ${description}`.toLowerCase();
  if (/cine|pel[ií]cula|cinemartium|cinef[oó]rum/.test(text)) return "Cine";
  if (/m[uú]sica|concierto|banda|d[uú]o|swing|pop|rock|jazz|órgano|festival de órgano/.test(text)) return "Música";
  if (/teatro|obra|escena|danza/.test(text)) return "Teatro";
  if (/exposici[oó]n|museo|arte|muestra/.test(text)) return "Exposiciones";
  if (/infantil|niños?|niñas?/.test(text)) return "Infantil";
  if (/visita.*guiada|patrimonio/.test(text)) return "Visitas";
  if (/conferencia|charla|presentaci[oó]n|literatura|poes[ií]a|libro|encuentro/.test(text)) return "Conferencias";
  if (/deporte|carrera|senderismo|rutas?|montaña|natación|fútbol|basket/.test(text)) return "Deporte";
  if (/fiesta|festival|verbena/.test(text)) return "Fiestas";
  return "Otros";
}

const AD_IMAGE_PATTERNS = [
  /banner/i,
  /publicidad/i,
  /patrocinad/i,
  /anuncio/i,
  /\.gif$/i,
  /\/ads?\//i,
  /\/ad-\w+/i,
  /728\s*[:x]\s*90/i,
  /300\s*[:x]\s*250/i,
  /160\s*[:x]\s*600/i,
  /320\s*[:x]\s*50/i,
  /970\s*[:x]\s*250/i,
  /googlead/i,
  /doubleclick/i,
  /googlesyndication/i,
  /facebook\.com\/tr/i,
  /fbcdn.*safety/i,
  /pixel/i,
  /track/i,
  /spacer/i,
  /blank\./i,
  /1x1\./i,
];

function isAdImage(url: string): boolean {
  if (!url) return false;
  return AD_IMAGE_PATTERNS.some((p) => p.test(url));
}

function extractListImages(html: string): Map<string, string> {
  const $ = cheerio.load(html);
  const map = new Map<string, string>();

  $(".mec-toggle-item-col").each((_, col) => {
    const title = $(col).closest(".mec-event-article").find(".mec-toggle-title").text().trim();
    if (!title) return;
    const img = $(col).find(".mec-event-image a img").first().attr("src");
    if (img && !map.has(title)) {
      const full = img.startsWith("http") ? img : `https://www.gasteizhoy.com${img}`;
      if (!isAdImage(full)) map.set(title, full);
    }
  });

  return map;
}

export async function scrapeGasteizHoy(): Promise<GasteizHoyEvent[]> {
  // Las dos peticiones comparten `Promise.all`, así que el plazo va en las dos: si
  // a una se le olvidara, la otra lo compensaría y el conjunto seguiría colgando.
  // El de `?view=list` es además opcional —es la que trae las imágenes—, y por eso
  // lleva su propio `catch`: que se caiga esa no puede tumbar el calendario.
  const [calendarRes, listRes] = await Promise.all([
    fetch(BASE_URL, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(20000) }),
    fetch(`${BASE_URL}?view=list`, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(20000) }).catch(() => null),
  ]);

  const calendarHtml = await calendarRes.text();
  const $ = cheerio.load(calendarHtml);
  const listImages = listRes ? extractListImages(await listRes.text()) : new Map<string, string>();

  const events: GasteizHoyEvent[] = [];
  const today = new Date().toISOString().slice(0, 10);

  $(".mec-calendar-events-sec").each((_, dayEl) => {
    const cell = $(dayEl).attr("data-mec-cell");
    if (!cell) return;

    const year = cell.slice(0, 4);
    const month = cell.slice(4, 6);
    const day = cell.slice(6, 8);
    const dateStr = `${year}-${month}-${day}`;

    if (dateStr < today) return;

    $(dayEl)
      .find("article.mec-event-article")
      .each((_, article) => {
        const $article = $(article);

        const noEvents = $article.find(".mec-event-detail").text().trim();
        if (noEvents === "Sin eventos") return;

        const linkEl = $article.find("h4.mec-event-title a");
        const title = linkEl.text().trim();
        const href = linkEl.attr("href") || "";

        if (!title) return;

        const timeText = $article.find(".mec-event-time").text().trim();
        const location = $article.find(".mec-event-loc-place").text().trim();

        const category = inferCategory(title, "");

        const calImg = $article.find(".mec-event-image img").first().attr("src");
        const calImageUrl = calImg
          ? calImg.startsWith("http") ? calImg : `https://www.gasteizhoy.com${calImg}`
          : "";
        const image = (calImageUrl && !isAdImage(calImageUrl))
          ? calImageUrl
          : listImages.get(title) || "";

        events.push({
          id: crypto.randomUUID(),
          title,
          date: dateStr,
          time: timeText,
          image,
          location,
          link: href,
          description: "",
          category,
          source: "gasteizhoy",
        });
      });
  });

  const missing = events.filter((e) => !e.image && e.link);
  if (missing.length && !process.env.NEXT_BUILD) {
    const CONCURRENCY = 5;
    for (let i = 0; i < missing.length; i += CONCURRENCY) {
      const chunk = missing.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map(async (e) => {
          const ogImage = await fetchOgImage(e.link);
          if (ogImage && !isAdImage(ogImage)) e.image = ogImage;
        })
      );
      results.forEach((r, j) => {
        if (r.status === "rejected") {
          console.warn(`Failed to fetch og:image for ${chunk[j].link}`);
        }
      });
    }
  }

  return events;
}
