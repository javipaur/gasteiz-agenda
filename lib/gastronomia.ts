import { getCurated, mapsLink, type Coords } from "./curated";
import { getProximosEventos, type Evento } from "./eventos";

export type Sitio = {
  slug: string;
  nombre: string;
  barrio: string;
  tipoCocina: string;
  rangoPrecio: "€" | "€€" | "€€€";
  direccion: string;
  coords?: Coords;
  linkMaps?: string;
  imagen?: string;
  descripcion: string;
  recomendado?: boolean;
};

export type ParadaPintxo = {
  nombre: string;
  direccion: string;
  pintxo: string;
  precio: string;
};

export type RutaPintxo = {
  slug: string;
  zona: string;
  nombre: string;
  paradas: ParadaPintxo[];
  duracion: string;
  consejo?: string;
};

export async function getSitios(): Promise<Sitio[]> {
  const sitios = await getCurated<Omit<Sitio, "linkMaps">[]>("gastronomia/sitios.json");
  return sitios.map((s) => ({ ...s, linkMaps: mapsLink(s.coords) as string | undefined }));
}

export async function getRutasPintxos(): Promise<RutaPintxo[]> {
  return getCurated<RutaPintxo[]>("gastronomia/rutas-pintxos.json");
}

export async function getEventosGastronomia(): Promise<Evento[]> {
  const eventos = await getProximosEventos();
  return eventos.filter((e) => e.category === "Gastronomía");
}