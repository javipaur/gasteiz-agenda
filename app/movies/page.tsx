import MoviesPageClient from "../components/MoviesPageClient";
import { scrapeBoulevard } from "@/app/services/boulevard";
import { scrapeFlorida } from "@/lib/sources/cines";

type Pelicula = {
  titulo: string;
  duracion: string;
  genero: string;
  imagen: string;
  link: string;
  horarios: string[];
  cine: string;
};

async function getPeliculas(): Promise<Pelicula[]> {
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

export const metadata = {
  title: "Cartelera de Cine — Vitoria-Gasteiz",
  description:
    "Películas en Cines Florida y Yelmo Cines Boulevard de Vitoria-Gasteiz. Horarios y compra de entradas.",
};

export default async function MoviesPage() {
  const peliculas = await getPeliculas();

  return <MoviesPageClient peliculas={peliculas} />;
}
