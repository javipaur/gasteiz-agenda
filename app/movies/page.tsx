export const revalidate = 300;

import MoviesPageClient from "../components/MoviesPageClient";
import { getPeliculas } from "@/lib/cines";

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
