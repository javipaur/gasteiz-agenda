import { getAgendaEventos } from "@/lib/agenda";
import { SITE_NAME, SITE_URL, eventDisplayDate } from "@/lib/seo";

export const revalidate = 300;

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const eventos = await getAgendaEventos({ days: 60 });
  const buildDate = new Date().toUTCString();

  const items = eventos
    .slice(0, 50)
    .map((ev) => {
      const url = `${SITE_URL}/evento/${ev.slug}`;
      const desc =
        ev.description?.slice(0, 250) ||
        `${ev.title} · ${eventDisplayDate(ev)} en ${ev.location}, Vitoria-Gasteiz.`;
      const enclosure = ev.image
        ? `\n    <enclosure url="${escapeXml(ev.image)}" type="image/jpeg" length="0"/>`
        : "";
      return `  <item>
    <title>${escapeXml(ev.title)}</title>
    <link>${url}</link>
    <guid isPermaLink="true">${url}</guid>
    <pubDate>${new Date(ev.date).toUTCString()}</pubDate>
    <description>${escapeXml(desc)}</description>
    <category>${escapeXml(ev.category || "Agenda")}</category>${enclosure}
  </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${escapeXml(SITE_NAME)} · Agenda de Vitoria-Gasteiz</title>
  <link>${SITE_URL}</link>
  <description>Conciertos, teatro, exposiciones, cine, deporte y planes en Vitoria-Gasteiz</description>
  <language>es-ES</language>
  <lastBuildDate>${buildDate}</lastBuildDate>
  <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
</channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
