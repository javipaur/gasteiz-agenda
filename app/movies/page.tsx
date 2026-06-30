import MoviesPageClient from "../components/MoviesPageClient";
import { scrapeBoulevard } from "@/app/services/boulevard";

type Pelicula = {
  titulo: string;
  duracion: string;
  genero: string;
  imagen: string;
  link: string;
  horarios: string[];
  cine: string;
};

const BASE_URL = process.env.API_BASE_URL || "https://gasteizclick.javierpalacio.es";
const API_FLORIDA = `${BASE_URL}/api/cines/Florida`;

async function getPeliculas(): Promise<Pelicula[]> {
  const [floridaRes, boulevardData] = await Promise.allSettled([
    fetch(API_FLORIDA, { next: { revalidate: 3600 } }).then((r) =>
      r.ok ? r.json() : { peliculas: [] }
    ),
    scrapeBoulevard(),
  ]);

  const fl: Pelicula[] = (
    floridaRes.status === "fulfilled" ? floridaRes.value.peliculas || [] : []
  ).map((p: any) => ({ ...p, cine: "Florida" }));

  const bl: Pelicula[] = (
    boulevardData.status === "fulfilled" ? boulevardData.value : []
  ).map((p: any) => ({ ...p, cine: "Boulevard" }));

  return [...fl, ...bl];
}

export const metadata = {
  title: "Cartelera de Cine — Vitoria-Gasteiz",
  description:
    "Películas en Cines Florida y Yelmo Cines Boulevard de Vitoria-Gasteiz. Horarios y compra de entradas.",
};

export default async function MoviesPage() {
  const peliculas = await getPeliculas();

  return <MoviesPageClient peliculas={peliculas} />;
}
