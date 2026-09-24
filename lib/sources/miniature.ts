import * as cheerio from "cheerio";

export type MiniatureEvento = {
  id: string;
  title: string;
  date: string;
  image?: string;
  location: string;
  link: string;
  category: string;
  time?: string;
  description?: string;
};

const API_URL = "https://miniature.pintxos.eus/wp-json/wp/v2/etn";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const MESES: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

type WpEtn = {
  id: number;
  title?: { rendered?: string };
  content?: { rendered?: string };
  link?: string;
  etn_category?: number[];
  _embedded?: {
    "wp:featuredmedia"?: Array<{ source_url?: string }>;
  };
};

function parseFecha(text: string): string {
  // Formats seen: "29 de septiembre 2026.", "1 de octubre 2025."
  const m = text
    .trim()
    .replace(/[.\s]+$/g, "")
    .match(/^(\d{1,2})\s+de\s+([a-záéíóúñ]+)(?:\s+de)?\s+(\d{4})$/i);
  if (!m) return "";
  const day = Number(m[1]);
  const month = MESES[m[2].toLowerCase()];
  const year = Number(m[3]);
  if (!month || day < 1 || day > 31) return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseHora(text: string): string {
  const m = text.trim().match(/(\d{1,2}):(\d{2})\s*h/i);
  if (!m) return "";
  return `${m[1]}:${m[2]}`;
}

function camposDelContenido(html: string): {
  fecha: string;
  hora: string;
  lugar: string;
} {
  const $ = cheerio.load(html);
  const texto = $("p")
    .map((_, el) => {
      $(el).find("br").replaceWith("\n");
      return $(el).text().trim();
    })
    .get()
    .join("\n");

  const fecha = texto.match(/Fecha:\s*([^\n]+)/i)?.[1] || "";
  const hora = texto.match(/Hora:\s*([^\n]+)/i)?.[1] || "";
  const lugar = texto.match(/Lugar:\s*([^\n]+)/i)?.[1] || "";

  return {
    fecha: parseFecha(fecha),
    hora: parseHora(hora),
    lugar: lugar.trim().replace(/[.\s]+$/g, ""),
  };
}

async function fetchPagina(page: number): Promise<WpEtn[]> {
  const url = new URL(API_URL);
  url.searchParams.set("per_page", "100");
  url.searchParams.set("page", String(page));
  url.searchParams.set("_embed", "1");

  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(90000),
    });

    if (!res.ok) {
      if (res.status !== 400) {
        console.error(`MINIATURE API returned ${res.status} (page ${page})`);
      }
      return [];
    }

    return (await res.json()) as WpEtn[];
  } catch (err) {
    console.error(
      `MINIATURE API failed (page ${page}): ${err instanceof Error ? err.message : String(err)}`
    );
    return [];
  }
}

export async function scrapeMiniature(): Promise<MiniatureEvento[]> {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const eventos: MiniatureEvento[] = [];
  let page = 1;

  while (page <= 10) {
    const items = await fetchPagina(page);
    if (items.length === 0) break;

    for (const item of items) {
      const title = item.title?.rendered?.trim();
      const contentHtml = item.content?.rendered || "";
      if (!title || !contentHtml) continue;

      const { fecha, hora, lugar } = camposDelContenido(contentHtml);

      const fechaDate = new Date(`${fecha}T12:00:00Z`);
      if (!fecha || isNaN(fechaDate.getTime()) || fechaDate < hoy) continue;

      const description =
        cheerio
          .load(contentHtml)
          .root()
          .text()
          .trim()
          .replace(/\s+/g, " ")
          .slice(0, 400);

      eventos.push({
        id: `miniature-${item.id}`,
        title,
        date: fecha,
        time: hora || undefined,
        location: lugar || "Vitoria-Gasteiz",
        link: item.link || `https://miniature.pintxos.eus`,
        category: "Gastronomía",
        image: item._embedded?.["wp:featuredmedia"]?.[0]?.source_url || undefined,
        description: description || undefined,
      });
    }

    page += 1;
  }

  return eventos;
}