import { NextResponse } from "next/server";
import { getAgendaEventos } from "@/lib/agenda";

export async function GET() {
  try {
    const agenda = await getAgendaEventos({ days: 90 });
    const kiosko = agenda
      .filter((e) => e.source === "rula")
      .slice(0, 100);

    return NextResponse.json({
      source: "lagenterula",
      category: "kiosko",
      count: kiosko.length,
      data: kiosko,
    });
  } catch (error) {
    console.error("Error obteniendo el kiosko cultural:", error);
    return NextResponse.json(
      { error: "No se pudieron obtener los eventos del kiosko" },
      { status: 500 }
    );
  }
}