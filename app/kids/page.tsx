export const revalidate = 300;

import KidsPageClient from "../components/KidsPageClient";
import { scrapeMunicipalCalendar } from "@/lib/sources/municipal";
import { getCachedOrFetch } from "@/lib/cache";
import { eventSlug } from "@/lib/slug";
import { JsonLd, itemListJsonLd } from "@/lib/seo";

type Evento = {
  id: string;
  title: string;
  date: string;
  image?: string;
  location?: string;
  link: string;
};

async function fetchKids(): Promise<Evento[]> {
  let raw: any[] = [];
  try {
    raw = await scrapeMunicipalCalendar({ dest: ["infantil"] });
  } catch {}

  return raw.map((e) => ({
    id: e.id ?? crypto.randomUUID(),
    title: e.title ?? "Evento sin título",
    date: e.date ?? "",
    image: e.image?.startsWith("http") ? e.image : undefined,
    location: e.location ?? "",
    link: e.link ?? "#",
  }));
}

async function getEventos(): Promise<Evento[]> {
  return getCachedOrFetch("kids-eventos", 5 * 60 * 1000, fetchKids);
}

export const metadata = {
  title: "Planes con Niños en Vitoria-Gasteiz",
  description:
    "Actividades, talleres y planes familiares con niños en Vitoria-Gasteiz.",
  alternates: { canonical: "/kids" },
};

export default async function KidsPage() {
  const eventos = await getEventos();
  return (
    <>
      <JsonLd
        data={itemListJsonLd(
          eventos
            .filter((e) => e.link && e.link !== "#")
            .map((e) => ({ ...e, slug: eventSlug(e), location: e.location || "Vitoria-Gasteiz" }))
            .slice(0, 50),
          "Planes con niños en Vitoria-Gasteiz",
          "/kids"
        )}
      />
      <KidsPageClient eventos={eventos} />
    </>
  );
}
