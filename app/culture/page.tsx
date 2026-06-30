import CulturePageClient from "../components/CulturePageClient";

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

async function fetchExternalSource(url: string): Promise<Evento[]> {
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const json = await res.json();
    const items: any[] = json?.data || [];
    return items.map((e: any) => ({
      id: e.id || crypto.randomUUID(),
      title: e.title || "Sin título",
      date: e.date || "",
      image: e.image?.startsWith("http") ? e.image : "",
      location: e.location || "",
      link: e.link || "",
      category: mapToCultureCategory(e.category),
      source: e.source || "desconocido",
    }));
  } catch {
    return [];
  }
}

async function getEventos(): Promise<Evento[]> {
  const BASE_URL = process.env.API_BASE_URL || "https://gasteizclick.javierpalacio.es";

  const urls = [
    { url: `${BASE_URL}/api/actividades/eventos/agenda/eventos`, category: "agenda", source: "municipal" },
    { url: `${BASE_URL}/api/actividades/eventos/agenda/teatro`, category: "teatro", source: "municipal" },
    { url: `${BASE_URL}/api/actividades/conciertos`, category: "conciertos", source: "jimmyjazz" },
    { url: `${BASE_URL}/api/actividades/eventos/agenda/concierto`, category: "conciertos", source: "municipal" },
    { url: `${BASE_URL}/api/actividades/eventos/agenda/exposiciones`, category: "exposiciones", source: "municipal" },
    { url: `${BASE_URL}/api/actividades/conciertos/vam`, category: "conciertos", source: "vam" },
  ];

  const responses = await Promise.all([
    ...urls.map(async ({ url, category, source }) => {
      try {
        const res = await fetch(url, { next: { revalidate: 3600 } });
        const data = await res.json();
        if (!Array.isArray(data)) return [];
        return data.map((evento: any) => ({ ...evento, category, source }));
      } catch {
        return [];
      }
    }),
    fetchExternalSource(`${BASE_URL}/api/fever`),
    fetchExternalSource(`${BASE_URL}/api/rula`),
    fetchExternalSource(`${BASE_URL}/api/gasteizhoy`),
  ]);

  return responses.flat().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}
export const metadata = {
  title: "Agenda Cultural en Vitoria-Gasteiz",
  description: "Teatro, conciertos, exposiciones y cultura en Vitoria-Gasteiz."
};
export default async function CulturePage() {
  const eventos = await getEventos();

  return <CulturePageClient eventos={eventos} />;
}