const MEC_API = "https://lagenterula.com/wp-json/mec/v1.0/events";
const MEC_TOKEN = "XiNUzsBFQJPQibGRODQ675Fz2qCpvWDATofFV0hr";

export interface RulaEvent {
  title: string;
  date: string;
  image: string;
  location: string;
  link: string;
  description: string;
  category: string;
}

interface MecEvent {
  ID: number;
  data: {
    title: string;
    content: string;
    featured_image: { large: string; full: string };
    locations: Record<string, { id: number; name: string; address: string }>;
    categories: Record<string, { id: number; name: string }>;
  };
  date: { start: { date: string } };
  time: { start_raw: string; end_raw: string };
  permalink: string;
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
  const res = await fetch(`${MEC_API}?limit=500`, {
    headers: { "mec-token": MEC_TOKEN, "User-Agent": "Mozilla/5.0" },
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    console.error(`MEC API returned ${res.status}`);
    return [];
  }

  const json: any = await res.json();
  const rawEvents: MecEvent[] = json.events
    ? (Object.values(json.events).flat() as MecEvent[])
    : [];

  const today = new Date().toISOString().slice(0, 10);

  const events: RulaEvent[] = rawEvents
    .filter((e) => {
      const dateStr = e.date?.start?.date || "";
      return dateStr >= today;
    })
    .map((e) => {
      const title = e.data?.title || "";
      const date = e.date?.start?.date || "";
      const image = e.data?.featured_image?.large || "";
      const locations = e.data?.locations || {};
      const location = Object.values(locations)[0]?.name || "";
      const link = e.permalink || "";
      const description = (e.data?.content || "").replace(/<[^>]+>/g, "").slice(0, 200);
      const categories = e.data?.categories || {};
      const categoryName = Object.values(categories)[0]?.name || "";
      const category = categoryName || inferCategory(title, description, link);

      return { title, date, image, location, link, description, category };
    })
    .filter((e) => e.title);

  return events;
}
