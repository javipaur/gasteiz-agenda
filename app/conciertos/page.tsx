export const revalidate = 300;

import ConciertosPageClient from "../components/ConciertosPageClient";
import { scrapeAllConciertos } from "@/lib/sources/conciertos";
import { getCachedOrFetch } from "@/lib/cache";

type Evento = {
  id: string;
  title: string;
  date: string;
  image: string;
  location: string;
  link: string;
  category: string;
  source: string;
  venue: string;
};

async function fetchEventos(): Promise<Evento[]> {
  const raw = await scrapeAllConciertos();
  return raw.map((e) => ({
    id: crypto.randomUUID(),
    title: e.title || "Sin título",
    date: e.date || "",
    image: e.image?.startsWith("http") ? e.image : "",
    location: e.location || "",
    link: e.link || "",
    category: "conciertos",
    source: e.venue.toLowerCase().replace(/\s+/g, "-"),
    venue: e.venue,
  }));
}

async function getEventos(): Promise<Evento[]> {
  return getCachedOrFetch("conciertos-eventos", 5 * 60 * 1000, fetchEventos);
}

export const metadata = {
  title: "Conciertos en Vitoria-Gasteiz — Gasteiz Click",
  description: "Conciertos y música en vivo en Vitoria-Gasteiz: Jimmy Jazz, HellDorado, Musikaze y más.",
};

export default async function ConciertosPage() {
  const eventos = await getEventos();
  return <ConciertosPageClient eventos={eventos} />;
}
