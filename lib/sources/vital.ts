import * as cheerio from "cheerio";

export interface VitalEvent {
  title: string;
  date: string;
  location: string;
  link: string;
  category: string;
}

const EVENTS_URL = "https://www.fundacionvital.eus/eventos";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

const MONTHS: Record<string, number> = {
  ene: 1,
  feb: 2,
  mar: 3,
  abr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dic: 12,
};

const MONTH_ES: Record<string, number> = {
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

function strip(value: string): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

// "5 de septiembre de 2026", "De junio a noviembre de 2026",
// "22 de junio de 2026", "Anualmente"
function parseFecha(label: string): string {
  const text = strip(label).toLowerCase();

  if (/anualmente|todo el a[ñn]o|continuo/i.test(text)) {
    return new Date().toISOString().slice(0, 10);
  }

  // fecha de un día: "5 de septiembre de 2026"
  const single = text.match(/(\d{1,2})\s+de\s+([a-zñ]+)\s+de\s+(\d{4})/);
  if (single) {
    const day = parseInt(single[1], 10);
    const month = MONTH_ES[single[2]];
    const year = parseInt(single[3], 10);
    if (day && month && year) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  // rango: "De junio a noviembre de 2026" o "Del x de junio al y de julio de 2026"
  const from = text.match(/de\s+([a-zñ]+)\s+(?:de\s+(\d{4}))?/);
  const to = text.match(/(?:a|al\s+\d{1,2})\s+de\s+([a-zñ]+)\s+de\s+(\d{4})/);
  if (to) {
    const month = MONTH_ES[to[1]];
    const year = parseInt(to[2], 10);
    if (month && year) {
      return `${year}-${String(month).padStart(2, "0")}-01`;
    }
  }
  if (from) {
    const month = MONTH_ES[from[1]];
    if (month) {
      const year = parseInt(from[2] as string, 10) || new Date().getFullYear();
      return `${year}-${String(month).padStart(2, "0")}-01`;
    }
  }

  // calendario: "1 ene", "22 jun", "7 al 8 jun"
  const cal = text.match(/(\d{1,2})\s+(?:al\s+\d{1,2}\s+)?([a-zñ]{3})\.?/);
  if (cal) {
    const day = parseInt(cal[1], 10);
    const month = MONTHS[cal[2].slice(0, 3)];
    if (day && month) {
      const today = new Date();
      let year = today.getFullYear();
      const d = new Date(year, month - 1, day);
      if (d.getTime() < today.getTime() - 1000 * 60 * 60 * 24 * 30) {
        year += 1;
      }
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return "";
}

export async function scrapeVital(): Promise<VitalEvent[]> {
  const res = await fetch(EVENTS_URL, {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) {
    console.error(`Fundación Vital returned ${res.status}`);
    return [];
  }

  const html = (await res.text()).replace(/\u00ef\u00bf\u00bd/gi, "");
  const $ = cheerio.load(html);
  const events: VitalEvent[] = [];
  const today = new Date().toISOString().slice(0, 10);

  $(".fundacion-agenda-evento").each((_, el) => {
    const card = $(el);

    const titleEl = card.find(".fundacion-eventos-title");
    const title = strip(titleEl.first().text());
    if (!title) return;

    const link = titleEl.first().attr("href") || "";
    const fullLink = link.startsWith("http")
      ? link
      : `https://www.fundacionvital.eus${link}`;

    const category = strip(
      card.find(".fundacion-eventos-tag a").first().text()
    );

    const location = strip(
      card.find(".fundacion-eventos-espacios").first().text()
    );

    const date = parseFecha(
      strip(card.find(".fundacion-eventos-fecha-txt").first().text())
    );
    if (!date || date < today) return;

    events.push({ title, date, location, link: fullLink, category });
  });

  return events;
}