import { NextResponse } from "next/server";
import { scrapeArkabia } from "@/lib/sources/arkabia";
import { getCachedOrFetch } from "@/lib/cache";

export const runtime = "nodejs";
export const revalidate = 3600;

export async function GET() {
  try {
    const eventos = await getCachedOrFetch(
      "arkabia",
      30 * 60 * 1000,
      scrapeArkabia
    );
    return NextResponse.json({
      source: "arkabia",
      category: "arkabia",
      count: eventos.length,
      data: eventos,
    });
  } catch (error) {
    console.error("Error scraping arkabia:", error);
    return NextResponse.json(
      { error: "No se pudieron obtener los eventos de Arkabia" },
      { status: 500 }
    );
  }
}