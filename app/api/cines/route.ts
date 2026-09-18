import { NextResponse } from "next/server";
import { scrapeFlorida, type Pelicula } from "@/lib/sources/cines";
import { scrapeBoulevard } from "@/app/services/boulevard";
import { getCachedOrFetch } from "@/lib/cache";

export const runtime = "nodejs";
export const revalidate = 3600;

type PeliculaConCine = Pelicula & { cine: "Florida" | "Boulevard" };

async function fetchPeliculas(): Promise<PeliculaConCine[]> {
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

export async function GET() {
  try {
    const peliculas = await getCachedOrFetch(
      "api-cines",
      5 * 60 * 1000,
      fetchPeliculas
    );
    return NextResponse.json({
      url: "https://www.reservaentradas.com/cine/alava/florida",
      scrapedAt: new Date().toISOString(),
      total: peliculas.length,
      peliculas,
    });
  } catch (error) {
    console.error("Error al obtener datos de los cines:", error);
    return NextResponse.json({ peliculas: [] }, { status: 200 });
  }
}