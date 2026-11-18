import { getCurated, mapsLink, type Coords } from "./curated";
import { getProximosEventos, type Evento } from "./eventos";
import { localDateStr } from "./utils";

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

export type EnsaladillaBar = {
  nombre: string;
  propuesta: string;
};

export type EnsaladillaZona = {
  nombre: string;
  bares: EnsaladillaBar[];
};

export type EnsaladillaCampeonato = {
  slug: string;
  nombre: string;
  edicion: number;
  fechas: { inicio: string; fin: string };
  final: { fecha: string; lugar: string };
  organiza: string[];
  descripcion: string;
  precio?: string;
  fuente: { nombre: string; url: string };
  zonas: EnsaladillaZona[];
};

export type EstadoEnsaladilla = "proximo" | "en-marcha" | "finalizado";

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

export async function getEnsaladillaCampeonato(): Promise<EnsaladillaCampeonato | null> {
  try {
    return await getCurated<EnsaladillaCampeonato>("gastronomia/ensaladilla-campeonato-2026.json");
  } catch {
    return null;
  }
}

export function estadoEnsaladilla(
  campeonato: EnsaladillaCampeonato,
  ahora: Date = new Date()
): EstadoEnsaladilla {
  const hoy = localDateStr(ahora);
  if (hoy < campeonato.fechas.inicio) return "proximo";
  if (hoy > campeonato.fechas.fin) return "finalizado";
  return "en-marcha";
}

export function totalBaresEnsaladilla(campeonato: EnsaladillaCampeonato): number {
  return campeonato.zonas.reduce((acc, z) => acc + z.bares.length, 0);
}