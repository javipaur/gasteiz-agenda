export const dynamic = 'force-dynamic';

import HeroSection from "./components/HeroSection";
import CategoriesGrid from "./components/CategoriesGrid";
import HomeEvents from "./components/HomeEvents";
import Newsletter from "./components/NewsLetter";

type Evento = {
  id: string;
  title: string;
  date: string;
  image?: string;
  location?: string;
  link?: string;
  category?: string;
  source?: string;
  time?: string;
  description?: string;
};

async function getEventos(): Promise<Evento[]> {
  try {
    const BASE_URL = process.env.API_BASE_URL || "https://gasteizclick.javierpalacio.es";
    const res = await fetch(
      `${BASE_URL}/api/actividades/eventos/proximos`,
      {
        next: { revalidate: 3600 },
      }
    );

    const data = await res.json();

    const rawEventos: any[] =
      data?.data || data?.eventos || (Array.isArray(data) ? data : []);

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    return rawEventos
      .map((e) => {
        const fecha = e.date ?? e.fecha ?? e.fecha_inicio ?? "";

        return {
          id: e.id ?? e._id ?? crypto.randomUUID(),
          title: e.title ?? e.nombre ?? e.titulo ?? "Evento sin título",
          date: fecha,
          location: e.location ?? e.ubicacion ?? "Lugar desconocido",
          link: e.link ?? e.url ?? "",
          image:
            e.image && e.image.startsWith("http")
              ? e.image
              : "",
          category: e.category ?? "",
          source: e.source ?? "",
          time: e.time ?? "",
          description: e.description ?? "",
        };
      })
      .filter((e) => {
        const fecha = new Date(e.date);
        return !isNaN(fecha.getTime()) && fecha >= hoy;
      })
      .sort(
        (a, b) =>
          new Date(a.date).getTime() - new Date(b.date).getTime()
      );
  } catch (error) {
    console.error("Error cargando eventos:", error);
    return [];
  }
}

export default async function HomeEventsPage() {
  const eventos = await getEventos();

  return (
    <>
      <HeroSection eventos={eventos} />
      <CategoriesGrid />
      <HomeEvents />
      <Newsletter />
    </>
  );
}