import { NextResponse } from "next/server";
import { getProximosEventos } from "@/lib/eventos";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate") || searchParams.get("date") || undefined;
  const endDate = searchParams.get("endDate") || undefined;

  try {
    const eventos = await getProximosEventos({ startDate, endDate });
    return NextResponse.json({ data: eventos });
  } catch (error) {
    console.error("Error en proximos:", error);
    return NextResponse.json(
      { error: "Error al obtener eventos" },
      { status: 500 }
    );
  }
}
