const MEC_API = "https://www.lagenterula.com/wp-json/mec/v1.0/events";

/**
 * El token del API MEC de La Genterula viene de `MEC_TOKEN`, no del código.
 *
 * Medido en esta sesión:
 * - sin token, o con uno inventado, el API responde 500: es obligatorio.
 * - no hay ruta pública equivalente. `wp-json/wp/v2/mec-events` responde sin
 *   token, pero su `content` es solo la descripción: no trae la fecha, la hora
 *   ni el lugar del evento, que es justo lo que necesita una agenda.
 * - el token no es un secreto: kioskokultura.org lo publica en su bundle JS.
 *
 * Sacarlo del código no lo revoca ni lo quita del historial de git. Lo que sí
 * compra es que a partir de ahora no viaja en cada despliegue ni en cada diff, y
 * rotarlo pasa a ser cambiar una variable en Dokploy en vez de editar código y
 *pushear.
 */

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
  // Se lee aqui y no al cargar el modulo para que un test pueda cambiarlo, y para
  // que rotar la variable no exija reiniciar nada.
  const token = process.env.MEC_TOKEN;

  // Sin token el API responde 500, asi que mejor no gastar la descarga: se avisa
  // y la fuente se queda vacia. El resto de la agenda sigue saliendo.
  if (!token) {
    console.warn(
      "[rula] MEC_TOKEN no esta definido: La Genterula no se consulta. Define la variable para incluirla."
    );
    return [];
  }

  const res = await fetch(`${MEC_API}?limit=500`, {
    headers: { "mec-token": token, "User-Agent": "Mozilla/5.0" },
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(30000),
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
