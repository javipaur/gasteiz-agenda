export const dynamic = 'force-dynamic';

// app/deporte/page.tsx
import SportPageClient from "../components/SportPageClient";

export type Evento = {
  id: string;
  title: string;
  date: string;
  image: string;
  location: string;
  link: string;
  category: "agenda" | "inscripciones" | "calendario" | "excursiones";
};

const BASE_URL = process.env.API_BASE_URL || "https://gasteizclick.javierpalacio.es";

const ENDPOINTS: { url: string; category: Evento["category"] }[] = [
  { url: `${BASE_URL}/api/actividades/carreras/agenda`, category: "agenda" },
  { url: `${BASE_URL}/api/actividades/carreras/calendario`, category: "calendario" },
  { url: `${BASE_URL}/api/actividades/carreras/inscripciones`, category: "inscripciones" },
  { url: `${BASE_URL}/api/actividades/senderismo`, category: "excursiones" },
];

// Función para parsear fechas con fallback
function parseDate(fecha?: string) {
  if (!fecha) return new Date().toISOString();
  const d = new Date(fecha);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

// Función para procesar la URL de la imagen de manera robusta
function getImageUrl(rawImage?: string) {
  const fallback = "/images/fallback.png"; // Imagen local en public/images/fallback.png
  if (!rawImage) return fallback;

  const image = rawImage.trim();
  if (image.startsWith("http")) return image;
  if (image.startsWith("/")) return `https://gasteizclick.javierpalacio.es${image}`;

  return fallback;
}

export default async function DeportePage() {
  const eventosArrays = await Promise.all(
    ENDPOINTS.map(async ({ url, category }) => {
      try {
        const res = await fetch(url);
        const json = await res.json();
        const rawData = Array.isArray(json) ? json : json.data ?? json.eventos ?? [];

        return rawData.map((evento: any) => ({
          id: evento.id ?? crypto.randomUUID(),
          title: evento.title || evento.nombre || "Sin título",
          date: parseDate(evento.date || evento.fecha_ini || evento.fecha),
          image: getImageUrl(evento.image || evento.imagen),
          location: evento.location || evento.poblacion || "Sin ubicación",
          link: evento.link || evento.web || "#",
          category,
        }));
      } catch (err) {
        console.error(`Error fetching ${url}:`, err);
        return [];
      }
    })
  );

  // Aplanar arrays y ordenar por fecha
  const eventos = eventosArrays
    .flat()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return <SportPageClient eventos={eventos} />;
}