import { NextResponse } from "next/server";
import { scrapeKoraExperiencias } from "@/lib/sources/kora";

export const revalidate = 3600;

export async function GET() {
  try {
    const experiencias = await scrapeKoraExperiencias();

    return NextResponse.json({
      source: "kora",
      category: "experiencias",
      count: experiencias.length,
      data: experiencias,
    });
  } catch (error) {
    console.error("Error obteniendo las experiencias de Kora:", error);
    return NextResponse.json(
      { error: "No se pudieron obtener las experiencias" },
      { status: 500 }
    );
  }
}
