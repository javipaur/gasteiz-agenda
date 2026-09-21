import { scrapeFlorida, type Pelicula } from "@/lib/sources/cines";
import { scrapeBoulevard } from "@/app/services/boulevard";
import { getCachedOrFetch } from "@/lib/cache";

export const CINES = ["Florida", "Boulevard"] as const;

export type Cine = (typeof CINES)[number];

export type PeliculaConCine = Pelicula & { cine: Cine };

export async function fetchPeliculasConCine(): Promise<PeliculaConCine[]> {
  const [florida, boulevard] = await Promise.allSettled([
    scrapeFlorida().then((data) =>
      data.map((p) => ({ ...p, cine: "Florida" as const }))
    ),
    scrapeBoulevard().then((data) =>
      data.map((p) => ({ ...p, cine: "Boulevard" as const }))
    ),
  ]);

  return [
    ...(florida.status === "fulfilled" ? florida.value : []),
    ...(boulevard.status === "fulfilled" ? boulevard.value : []),
  ];
}

export function getPeliculas(): Promise<PeliculaConCine[]> {
  return getCachedOrFetch("api-cines", 5 * 60 * 1000, fetchPeliculasConCine);
}