import { scrapeFlorida, type Pelicula } from "@/lib/sources/cines";
import { scrapeBoulevard } from "@/app/services/boulevard";
import { getCachedOrFetch } from "@/lib/cache";

export const CINES = ["Florida", "Boulevard"] as const;

export type Cine = (typeof CINES)[number];

export type PeliculaConCine = Pelicula & { cine: Cine };

export type PeliculasResultado = {
  peliculas: PeliculaConCine[];
  /** Cines cuyo scrape fallo. Vacio = los dos respondieron. */
  fallidos: Cine[];
};

/**
 * Combina los dos cines y dice cuales fallaron, en vez de devolver lo que salga.
 *
 * `Promise.allSettled` antes agrupaba el fallo con el vacio: si Boulevard caia,
 * la respuesta era 200 con las peliculas de Florida y nada mas, y el cliente no
 * tenia forma de saber que le falta medio cine. Ahora los dos estados se
 * distinguen:
 *
 * - los dos fallan -> `fallidos` tiene los dos, y la ruta responde 502;
 * - uno falla -> se devuelven las del otro y la ruta lo dice en `cinesConError`,
 *   para que la app pueda avisar en vez de pintar una cartelera a medias sin
 *   avisar.
 *
 * Un cine que responde y no tiene peliculas **no** es un fallo: es un cine sin
 * cartelera, que es un 200 con lista vacia.
 */
export async function fetchPeliculasConCine(): Promise<PeliculasResultado> {
  const [florida, boulevard] = await Promise.allSettled([
    scrapeFlorida().then((data) =>
      data.map((p) => ({ ...p, cine: "Florida" as const }))
    ),
    scrapeBoulevard().then((data) =>
      data.map((p) => ({ ...p, cine: "Boulevard" as const }))
    ),
  ]);

  const peliculas: PeliculaConCine[] = [
    ...(florida.status === "fulfilled" ? florida.value : []),
    ...(boulevard.status === "fulfilled" ? boulevard.value : []),
  ];

  const fallidos: Cine[] = [];
  if (florida.status === "rejected") {
    fallidos.push("Florida");
    console.error("scrapeFlorida fallo:", florida.reason);
  }
  if (boulevard.status === "rejected") {
    fallidos.push("Boulevard");
    console.error("scrapeBoulevard fallo:", boulevard.reason);
  }

  return { peliculas, fallidos };
}

/** Indice de las dos fuentes, para que las rutas no repitan las URLs. */
export const CINE_SOURCES = {
  Florida: "https://www.reservaentradas.com/cine/alava/florida",
  Boulevard: "https://www.sensacine.com/cines/cine/E0786/",
} as const satisfies Record<Cine, string>;

export function getPeliculas(): Promise<PeliculasResultado> {
  return getCachedOrFetch("api-cines", 5 * 60 * 1000, fetchPeliculasConCine);
}