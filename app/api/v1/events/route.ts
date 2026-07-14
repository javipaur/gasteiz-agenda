import { NextResponse } from "next/server";
import { getProximosEventos } from "@/lib/eventos";
import type { Evento } from "@/lib/eventos";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const startDate =
    searchParams.get("startDate") || searchParams.get("date") || undefined;
  const endDate = searchParams.get("endDate") || undefined;
  const category = searchParams.get("category")?.toLowerCase() || undefined;
  const source = searchParams.get("source")?.toLowerCase() || undefined;
  const search = searchParams.get("search")?.toLowerCase() || undefined;
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10), 1), 200);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

  try {
    let eventos = await getProximosEventos({ startDate, endDate });

    if (category) {
      eventos = eventos.filter(
        (e) => e.category?.toLowerCase().includes(category)
      );
    }

    if (source) {
      eventos = eventos.filter(
        (e) => e.source?.toLowerCase() === source
      );
    }

    if (search) {
      eventos = eventos.filter(
        (e) =>
          e.title?.toLowerCase().includes(search) ||
          e.location?.toLowerCase().includes(search) ||
          e.description?.toLowerCase().includes(search)
      );
    }

    const total = eventos.length;
    const paginated = eventos.slice(offset, offset + limit);

    return NextResponse.json({
      data: paginated,
      meta: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("Error en /api/v1/events:", error);
    return NextResponse.json(
      { error: "Error al obtener eventos" },
      { status: 500 }
    );
  }
}
