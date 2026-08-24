import { AgendaEvento } from "./agenda";

export const SITE_URL = "https://gasteizclick.javierpalacio.es";
export const SITE_NAME = "Gasteiz Click";

export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

function madridIso(dateStr: string, time?: string): string | undefined {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return undefined;

  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hhmm =
    time && /^\d{1,2}[:.]\d{2}/.test(time)
      ? time.replace(".", ":").slice(0, 5)
      : "18:00";

  const probe = new Date(
    `${y}-${m}-${day}T${hhmm}:00Z`
  );
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    timeZoneName: "shortOffset",
  }).formatToParts(probe);
  const tzName =
    parts.find((p) => p.type === "timeZoneName")?.value || "GMT+1";
  const match = tzName.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/);
  const offset = match
    ? `${match[1].length === 2 ? match[1].replace("+", "+0").replace("-", "-0") : match[1]}:${match[2] || "00"}`
    : "+01:00";

  return `${y}-${m}-${day}T${hhmm}:00${offset}`;
}

export function webSiteJsonLd() {
  return {
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: SITE_NAME,
    inLanguage: "es-ES",
    description:
      "Agenda cultural de Vitoria-Gasteiz: conciertos, teatro, exposiciones, cine, deporte y planes familiares.",
    publisher: { "@id": `${SITE_URL}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/culture?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function organizationJsonLd() {
  return {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/icon-512.png`,
    },
    areaServed: {
      "@type": "City",
      name: "Vitoria-Gasteiz",
    },
  };
}

export function graphJsonLd(...nodes: object[]) {
  return {
    "@context": "https://schema.org",
    "@graph": nodes,
  };
}

export function eventToJsonLd(evento: AgendaEvento) {
  const startDate = madridIso(evento.date, evento.time);
  if (!startDate) return null;

  const endDate = evento.dateEnd ? madridIso(evento.dateEnd, evento.time) : undefined;

  const event: Record<string, unknown> = {
    "@type": "Event",
    "@id": `${SITE_URL}/evento/${evento.slug}#event`,
    name: evento.title,
    url: `${SITE_URL}/evento/${evento.slug}`,
    startDate,
    eventStatus: evento.cancelled
      ? "https://schema.org/EventCancelled"
      : "https://schema.org/EventScheduled",
    location: {
      "@type": "Place",
      name: evento.location,
      address: {
        "@type": "PostalAddress",
        addressLocality: "Vitoria-Gasteiz",
        addressRegion: "Álava",
        addressCountry: "ES",
      },
    },
    organizer: { "@id": `${SITE_URL}/#organization` },
  };

  if (endDate) event.endDate = endDate;
  if (evento.image) event.image = [evento.image];
  if (evento.description)
    event.description = evento.description.slice(0, 300);

  if (evento.link) {
    event.offers = {
      "@type": "Offer",
      url: evento.link,
      availability: "https://schema.org/InStock",
    };
  }

  return event;
}

export function itemListJsonLd(
  eventos: AgendaEvento[],
  listName: string,
  listUrl: string
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: listName,
    url: `${SITE_URL}${listUrl}`,
    numberOfItems: eventos.length,
    itemListElement: eventos
      .map((ev) => eventToJsonLd(ev))
      .filter(Boolean)
      .slice(0, 100)
      .map((event, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: event,
      })),
  };
}

export function breadcrumbJsonLd(items: { name: string; url?: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      ...(item.url ? { item: `${SITE_URL}${item.url}` } : {}),
    })),
  };
}

export function eventDisplayDate(evento: AgendaEvento): string {
  const d = new Date(evento.date);
  if (isNaN(d.getTime())) return "";
  let out = d.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  if (evento.time) out += ` · ${evento.time}`;
  return out.charAt(0).toUpperCase() + out.slice(1);
}
