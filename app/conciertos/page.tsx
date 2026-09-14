export const revalidate = 300;

import ConciertosPageClient from "../components/ConciertosPageClient";
import { scrapeAllConciertos } from "@/lib/sources/conciertos";
import { getCachedOrFetch } from "@/lib/cache";
import { eventSlug } from "@/lib/slug";
import { JsonLd, itemListJsonLd } from "@/lib/seo";

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
  title: "Conciertos en Vitoria-Gasteiz · Gasteiz Click",
  description:
    "Conciertos y música en vivo en Vitoria-Gasteiz: Jimmy Jazz, HellDorado, Musikaze y más.",
  alternates: { canonical: "/conciertos" },
};

export default async function ConciertosPage() {
  const eventos = await getEventos();
  return (
    <>
      <JsonLd
        data={itemListJsonLd(
          eventos
            .filter((e) => e.link)
            .map((e) => ({ ...e, slug: eventSlug(e), description: undefined }))
            .slice(0, 50),
          "Conciertos en Vitoria-Gasteiz",
          "/conciertos"
        )}
      />
      <ConciertosPageClient eventos={eventos} />
    </>
  );
}
