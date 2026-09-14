export const revalidate = 300;

import MoviesPageClient from "../components/MoviesPageClient";
import { scrapeBoulevard } from "@/app/services/boulevard";
import { scrapeFlorida } from "@/lib/sources/cines";
import { getCachedOrFetch } from "@/lib/cache";

type Pelicula = {
  titulo: string;
  duracion: string;
  genero: string;
  imagen: string;
  link: string;
  horarios: string[];
  cine: string;
};

async function fetchPeliculas(): Promise<Pelicula[]> {
  const [floridaRes, boulevardData] = await Promise.allSettled([
    scrapeFlorida().then((data) => data.map((p: any) => ({ ...p, cine: "Florida" }))),
    scrapeBoulevard().then((data) => data.map((p: any) => ({ ...p, cine: "Boulevard" }))),
  ]);

  const fl: Pelicula[] =
    floridaRes.status === "fulfilled" ? floridaRes.value : [];

  const bl: Pelicula[] =
    boulevardData.status === "fulfilled" ? boulevardData.value : [];

  return [...fl, ...bl];
}

async function getPeliculas(): Promise<Pelicula[]> {
  return getCachedOrFetch("peliculas", 5 * 60 * 1000, fetchPeliculas);
}

export const metadata = {
  title: "Cartelera de Cine · Vitoria-Gasteiz",
  description:
    "Películas en Cines Florida y Yelmo Cines Boulevard de Vitoria-Gasteiz. Horarios y compra de entradas.",
  alternates: { canonical: "/movies" },
};

export default async function MoviesPage() {
  const peliculas = await getPeliculas();
  return <MoviesPageClient peliculas={peliculas} />;
}
