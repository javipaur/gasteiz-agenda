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
  // `getPeliculas` devuelve tambien los cines que fallaron. La pagina se pinta
  // con las que hay: si uno de los dos caido, se ven las del otro en vez de
  // una cartelera vacia, que era lo que pasaba antes.
  const { peliculas } = await getPeliculas();
  return <MoviesPageClient peliculas={peliculas} />;
}
