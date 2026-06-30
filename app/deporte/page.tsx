export const dynamic = 'force-dynamic';

import SportPageClient from "../components/SportPageClient";
import { scrapeMunicipalCalendar } from "@/lib/sources/municipal";
import { scrapeBuscametasCalendario } from "@/lib/sources/buscametas";
import { scrapeBuscametasInscripciones } from "@/lib/sources/buscametas";
import { scrapeSenderismo } from "@/lib/sources/senderismo";

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
  const fallback = "/images/fallback.png";
  if (!rawImage) return fallback;
  const image = rawImage.trim();
  if (image.startsWith("http")) return image;
  if (image.startsWith("/")) return `https://gasteizclick.javierpalacio.es${image}`;
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

export default async function DeportePage() {
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

  return <SportPageClient eventos={eventos} />;
}
