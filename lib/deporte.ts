import { getCachedOrFetch } from "./cache";
import { scrapeMunicipalCalendar } from "./sources/municipal";
import {
  scrapeBuscametasCalendario,
  scrapeBuscametasInscripciones,
} from "./sources/buscametas";
import { scrapeSenderismo } from "./sources/senderismo";
import type { Evento } from "./eventos";

type FuenteEvento = {
  id?: string;
  title?: string;
  date?: string;
  image?: string;
  location?: string;
  poblacion?: string;
  link?: string;
};

function toEvento(e: FuenteEvento, category: string, source: string): Evento {
  const date = e.date ?? new Date().toISOString();
  return {
    id: e.id ?? crypto.randomUUID(),
    title: e.title ?? "Sin título",
    date,
    image:
      typeof e.image === "string" && e.image.startsWith("http")
        ? e.image
        : undefined,
    location: e.location ?? e.poblacion ?? "Vitoria-Gasteiz",
    link: e.link && e.link !== "#" ? e.link : "",
    category,
    source,
  };
}

async function fetchDeporteEventos(): Promise<Evento[]> {
  const [agenda, calendario, inscripciones, excursiones] = await Promise.allSettled([
    scrapeMunicipalCalendar({ calendariosID: 168 }),
    scrapeBuscametasCalendario(),
    scrapeBuscametasInscripciones(),
    scrapeSenderismo(),
  ]);

  const eventos: Evento[] = [];

  if (agenda.status === "fulfilled") {
    eventos.push(
      ...(agenda.value as FuenteEvento[]).map((e) =>
        toEvento(e, "Agenda", "vitoria-gasteiz")
      )
    );
  }
  if (calendario.status === "fulfilled") {
    eventos.push(
      ...(calendario.value as FuenteEvento[]).map((e) =>
        toEvento(e, "Calendario", "buscametas")
      )
    );
  }
  if (inscripciones.status === "fulfilled") {
    eventos.push(
      ...(inscripciones.value as FuenteEvento[]).map((e) =>
        toEvento(e, "Inscripciones", "buscametas")
      )
    );
  }
  if (excursiones.status === "fulfilled") {
    eventos.push(
      ...(excursiones.value as FuenteEvento[]).map((e) =>
        toEvento(e, "Senderismo", "cm-gazteiz")
      )
    );
  }

  return eventos.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

export function getDeporteEventos(): Promise<Evento[]> {
  return getCachedOrFetch(
    "deporte-eventos-mood",
    5 * 60 * 1000,
    fetchDeporteEventos
  );
}