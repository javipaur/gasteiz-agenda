export const revalidate = 300;

import type { Metadata } from "next";
import SportPageClient from "../components/SportPageClient";
import { scrapeMunicipalCalendar } from "@/lib/sources/municipal";
import { scrapeBuscametasCalendario, scrapeBuscametasInscripciones } from "@/lib/sources/buscametas";
import { scrapeSenderismo } from "@/lib/sources/senderismo";
import { getCachedOrFetch } from "@/lib/cache";
import { eventSlug } from "@/lib/slug";
import { JsonLd, itemListJsonLd } from "@/lib/seo";

export type Evento = {
  id: string;
  title: string;
  date: string;
  image: string;
  location: string;
  link: string;
  category: "agenda" | "inscripciones" | "calendario" | "excursiones";
};

function parseDate(fecha?: string) {
  if (!fecha) return new Date().toISOString();
  const d = new Date(fecha);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function getImageUrl(rawImage?: string) {
  const fallback = "";
  if (!rawImage) return fallback;
  const image = rawImage.trim();
  if (image.startsWith("http")) return image;
  return fallback;
}

function mapEvento(evento: any, category: Evento["category"]): Evento {
  return {
    id: evento.id ?? crypto.randomUUID(),
    title: evento.title || evento.nombre || "Sin título",
    date: parseDate(evento.date || evento.fecha_ini || evento.fecha),
    image: getImageUrl(evento.image || evento.imagen),
    location: evento.location || evento.poblacion || "Sin ubicación",
    link: evento.link || evento.web || "#",
    category,
  };
}

async function fetchDeportes(): Promise<Evento[]> {
  const [agenda, calendario, inscripciones, excursiones] = await Promise.allSettled([
    scrapeMunicipalCalendar({ calendariosID: 168 }),
    scrapeBuscametasCalendario(),
    scrapeBuscametasInscripciones(),
    scrapeSenderismo(),
  ]);

  const eventos: Evento[] = [];

  if (agenda.status === "fulfilled") {
    eventos.push(...agenda.value.map((e) => mapEvento(e, "agenda")));
  }
  if (calendario.status === "fulfilled") {
    eventos.push(...calendario.value.map((e) => mapEvento(e, "calendario")));
  }
  if (inscripciones.status === "fulfilled") {
    eventos.push(...inscripciones.value.map((e) => mapEvento(e, "inscripciones")));
  }
  if (excursiones.status === "fulfilled") {
    eventos.push(...excursiones.value.map((e) => mapEvento(e, "excursiones")));
  }

  eventos.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return eventos;
}

async function getEventos(): Promise<Evento[]> {
  return getCachedOrFetch("deporte-eventos", 5 * 60 * 1000, fetchDeportes);
}

type PageProps = {
  searchParams: Promise<{ q?: string }>;
};

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const { q } = await searchParams;

  if (q) {
    return {
      title: `Búsqueda: ${q}`,
      robots: { index: false, follow: true },
    };
  }

  return {
    title: "Agenda Deportiva en Vitoria-Gasteiz",
    description:
      "Carreras, senderismo y eventos deportivos en Vitoria-Gasteiz.",
    alternates: { canonical: "/deporte" },
  };
}

export default async function DeportePage() {
  const eventos = await getEventos();
  return (
    <>
      <JsonLd
        data={itemListJsonLd(
          eventos
            .filter((e) => e.link && e.link !== "#")
            .map((e) => ({ ...e, slug: eventSlug(e) }))
            .slice(0, 50),
          "Agenda deportiva de Vitoria-Gasteiz",
          "/deporte"
        )}
      />
      <SportPageClient eventos={eventos} />
    </>
  );
}
