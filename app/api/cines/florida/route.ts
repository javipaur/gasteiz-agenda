import { NextResponse } from "next/server";
import { scrapeFlorida } from "@/lib/sources/cines";

export const runtime = "nodejs";
export const revalidate = 3600;

export async function GET() {
  try {
    const peliculas = await scrapeFlorida();
    return NextResponse.json(peliculas);
  } catch (error) {
    console.error("Error al obtener datos de Cine Florida:", error);
    return NextResponse.json([]);
  }
}
