export const dynamic = 'force-dynamic';

import CulturePageClient from "../components/CulturePageClient";
import { scrapeMunicipalCalendar } from "@/lib/sources/municipal";
import { scrapeJimmyJazz } from "@/lib/sources/conciertos";
import { scrapeVamConciertos } from "@/lib/sources/vam";
import { scrapeFever } from "@/lib/sources/fever";
import { scrapeRula } from "@/lib/sources/rula";
import { scrapeGasteizHoy } from "@/lib/sources/gasteizhoy";

type Evento = {
  id: string;
  title: string;
  date: string;
  image: string;
  location: string;
  link: string;
  category: string;
  source: string;
};

function mapToCultureCategory(category: string): string {
  const cat = category.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (cat === "teatro") return "teatro";
  if (["musica", "conciertos", "concierto"].includes(cat)) return "conciertos";
  if (["exposiciones", "exposicion"].includes(cat)) return "exposiciones";
  return "agenda";
}

function normalizeEvento(e: any, category: string, source: string): Evento {
  return {
    id: e.id || crypto.randomUUID(),
    title: e.title || "Sin título",
    date: e.date || "",
    image: e.image?.startsWith("http") ? e.image : "",
    location: e.location || "",
    link: e.link || "",
    category: mapToCultureCategory(e.category || category),
    source: e.source || source,
  };
}

async function getEventos(): Promise<Evento[]> {
  const [municipalEventos, municipalTeatro, jimmyJazz, municipalConcierto, vamConciertos, municipalExposiciones, fever, rula, gasteizhoy] = await Promise.allSettled([
    scrapeMunicipalCalendar({ tipo: [6] }),
    scrapeMunicipalCalendar({ tipo: [13] }),
    scrapeJimmyJazz(),
    scrapeMunicipalCalendar({ tipo: [2] }),
    scrapeVamConciertos(),
    scrapeMunicipalCalendar({ tipo: [7] }),
    scrapeFever(),
    scrapeRula(),
    scrapeGasteizHoy(),
  ]);

  const eventos: Evento[] = [];

  if (municipalEventos.status === "fulfilled") {
    eventos.push(...municipalEventos.value.map((e) => normalizeEvento(e, "agenda", "municipal")));
  }
  if (municipalTeatro.status === "fulfilled") {
    eventos.push(...municipalTeatro.value.map((e) => normalizeEvento(e, "teatro", "municipal")));
  }
  if (jimmyJazz.status === "fulfilled") {
    eventos.push(...jimmyJazz.value.map((e) => normalizeEvento(e, "conciertos", "jimmyjazz")));
  }
  if (municipalConcierto.status === "fulfilled") {
    eventos.push(...municipalConcierto.value.map((e) => normalizeEvento(e, "conciertos", "municipal")));
  }
  if (vamConciertos.status === "fulfilled") {
    eventos.push(...vamConciertos.value.map((e) => normalizeEvento(e, "conciertos", "vam")));
  }
  if (municipalExposiciones.status === "fulfilled") {
    eventos.push(...municipalExposiciones.value.map((e) => normalizeEvento(e, "exposiciones", "municipal")));
  }
  if (fever.status === "fulfilled") {
    eventos.push(...fever.value.map((e) => normalizeEvento(e, e.category, "fever")));
  }
  if (rula.status === "fulfilled") {
    eventos.push(...rula.value.map((e) => normalizeEvento(e, e.category, "rula")));
  }
  if (gasteizhoy.status === "fulfilled") {
    eventos.push(...gasteizhoy.value.map((e) => normalizeEvento(e, e.category, "gasteizhoy")));
  }

  return eventos.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export const metadata = {
  title: "Agenda Cultural en Vitoria-Gasteiz",
  description: "Teatro, conciertos, exposiciones y cultura en Vitoria-Gasteiz."
};

export default async function CulturePage() {
  const eventos = await getEventos();

  return <CulturePageClient eventos={eventos} />;
}
