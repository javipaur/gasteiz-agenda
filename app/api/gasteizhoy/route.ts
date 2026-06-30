import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

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

export async function scrapeGasteizHoy(): Promise<GasteizHoyEvent[]> {
  const res = await fetch(BASE_URL, { next: { revalidate: 3600 } });
  const html = await res.text();
  const $ = cheerio.load(html);

  const events: GasteizHoyEvent[] = [];

  $(".mec-calendar-events-sec").each((_, dayEl) => {
    const cell = $(dayEl).attr("data-mec-cell");
    if (!cell) return;

    const year = cell.slice(0, 4);
    const month = cell.slice(4, 6);
    const day = cell.slice(6, 8);
    const dateStr = `${year}-${month}-${day}`;

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

        let image = "";
        const ogImage = $('meta[property="og:image"]').attr("content") || "";

        const category = inferCategory(title, "");

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

  return events;
}

export async function GET() {
  try {
    const events = await scrapeGasteizHoy();
    return NextResponse.json({
      source: "gasteizhoy",
      count: events.length,
      data: events,
    });
  } catch (error) {
    console.error("Error scraping Gasteiz Hoy:", error);
    return NextResponse.json(
      { error: "Error al consultar eventos de Gasteiz Hoy" },
      { status: 500 }
    );
  }
}
