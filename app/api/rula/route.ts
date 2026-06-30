import { NextResponse } from "next/server";
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

function inferCategory(
  title: string,
  description: string,
  url: string
): string {
  const text = `${title} ${description} ${url}`.toLowerCase();
  if (/cine|pel[ií]cula|v\.?\s*o\.?\s*s\.?\s*e|jazzinema|cinef[oó]rum/.test(text))
    return "Cine";
  if (
    /m[uú]sica|concierto|banda|d[uú]o|big band|[oó]rgano|swing|pop|rock/.test(
      text
    )
  )
    return "Música";
  if (/teatro|obra|escena|danza/.test(text)) return "Teatro";
  if (/exposici[oó]n|museo|arte|goya/.test(text)) return "Exposiciones";
  if (/infantil|niños?|niñas?/.test(text)) return "Infantil";
  if (/visita.*guiada|patrimonio/.test(text)) return "Visitas";
  if (
    /conferencia|charla|presentaci[oó]n|literatura|poes[ií]a|libro/.test(text)
  )
    return "Conferencias";
  if (/senderismo|rutas?|montaña/.test(text)) return "Senderismo";
  return "Otros";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function scrapeRula(): Promise<RulaEvent[]> {
  const res = await fetch(BASE_URL, { next: { revalidate: 3600 } });
  const html = await res.text();
  const $ = cheerio.load(html);

  const listings: {
    href: string;
    title: string;
    image: string;
    time: string;
    location: string;
  }[] = [];

  $(".mec-event-article").each((_, el) => {
    const $el = $(el);
    const linkEl = $el.find(".mec-event-title a");
    const href = linkEl.attr("href") || "";
    if (!href.includes("/events/")) return;

    listings.push({
      href,
      title: linkEl.text().trim(),
      image:
        $el.find(".mec-event-image img").attr("data-src") ||
        $el.find(".mec-event-image img").attr("src") ||
        "",
      time: $el.find(".mec-event-time").text().replace(/^\s*/, "").trim(),
      location: $el.find(".mec-event-loc-place").text().trim(),
    });
  });

  const homepageJsonldMap = new Map<string, any>();
  $('script[type="application/ld+json"]').each((_, script) => {
    try {
      const data = JSON.parse($(script).text());
      if (data["@type"] === "Event" && data.url) {
        homepageJsonldMap.set(data.url, data);
      }
    } catch {
      // skip invalid JSON
    }
  });

  const uniqueUrls = [...new Set(listings.map((l) => l.href))];
  const events: RulaEvent[] = [];

  for (let i = 0; i < uniqueUrls.length; i++) {
    const url = uniqueUrls[i];
    await delay(150);

    let jsonld: any = {};
    let detailOk = false;

    try {
      const detailRes = await fetch(url, { next: { revalidate: 3600 } });
      if (detailRes.ok) {
        const detailHtml = await detailRes.text();
        const $detail = cheerio.load(detailHtml);
        $detail('script[type="application/ld+json"]').each((_, script) => {
          try {
            const data = JSON.parse($detail(script).text());
            if (data["@type"] === "Event") {
              Object.assign(jsonld, data);
            }
          } catch {
            // skip
          }
        });
        detailOk = !!jsonld.name;
      }
    } catch {
      // detail fetch failed
    }

    if (!detailOk) {
      const hData = homepageJsonldMap.get(url);
      if (hData) jsonld = hData;
    }

    const listing = listings.find((l) => l.href === url);
    const title = jsonld.name || listing?.title || "";
    const date = jsonld.startDate || "";
    const image = jsonld.image || listing?.image || "";
    const location = jsonld.location?.name || listing?.location || "";
    const description = jsonld.description || "";
    const link = jsonld.url || url;
    const category = inferCategory(title, description, url);

    events.push({ title, date, image, location, link, description, category });
  }

  return events;
}

export async function GET() {
  try {
    const events = await scrapeRula();
    return NextResponse.json({
      source: "lagenterula",
      count: events.length,
      data: events,
    });
  } catch (error) {
    console.error("Error scraping lagenterula:", error);
    return NextResponse.json(
      { error: "Error al consultar eventos de La Gente Rula" },
      { status: 500 }
    );
  }
}
