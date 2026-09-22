import { getCurated, mapsLink, type Coords } from "./curated";
import { getProximosEventos, type Evento } from "./eventos";

export type FichaCurada = {
  slug: string;
  nombre: string;
  imagen?: string;
  descripcion: string;
  zona?: string;
  coords?: Coords;
  linkMaps?: string;
  linkOficial?: string;
  tags?: string[];
};

export type Ruta = {
  slug: string;
  nombre: string;
  dificultad: "Baja" | "Media" | "Alta";
  duracion: string;
  distancia: string;
  puntoSalida: string;
  coords?: Coords;
  linkMaps?: string;
  imagen?: string;
  descripcion: string;
};

export type InfoPractica = {
  intro: string;
  bloques: Array<{ id: string; titulo: string; icono: string; items: string[] }>;
};

function withMapLink<T extends { coords?: Coords; linkMaps?: string }>(item: T): T {
  if (!item.linkMaps) item.linkMaps = mapsLink(item.coords) as string | undefined;
  return item;
}

export async function getQueVer(): Promise<FichaCurada[]> {
  const items = await getCurated<Omit<FichaCurada, "linkMaps">[]>("turismo/que-ver.json");
  return items.map(withMapLink);
}

export async function getRutasTurismo(): Promise<Ruta[]> {
  const rutas = await getCurated<Omit<Ruta, "linkMaps">[]>("turismo/rutas.json");
  return rutas.map(withMapLink);
}

export async function getInfoPractica(): Promise<InfoPractica> {
  return getCurated<InfoPractica>("turismo/info-practica.json");
}

export async function getVisitasGuiadas(): Promise<Evento[]> {
  const eventos = await getProximosEventos();
  return eventos.filter(
    (e) =>
      e.category === "Visitas" ||
      /visita guiada|tour|itinerario/i.test(`${e.title} ${e.description || ""}`)
  );
}