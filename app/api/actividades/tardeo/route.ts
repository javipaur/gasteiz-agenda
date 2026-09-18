import { NextResponse } from "next/server";
import { getAgendaEventos } from "@/lib/agenda";

function horaInicio(time: string | undefined): number | null {
  if (!time) return null;
  const m = time.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]);
}

export async function GET() {
  try {
    const agenda = await getAgendaEventos({ days: 30 });
    const tardeo = agenda
      .filter((e) => {
        const h = horaInicio(e.time);
        return h !== null && h >= 16 && h < 22;
      })
      .sort(
        (a, b) =>
          `${a.date} ${a.time || ""}`.localeCompare(`${b.date} ${b.time || ""}`)
      )
      .slice(0, 50);

    return NextResponse.json({
      source: "agregado",
      category: "tardeo",
      count: tardeo.length,
      data: tardeo,
    });
  } catch (error) {
    console.error("Error obteniendo el tardeo:", error);
    return NextResponse.json(
      { error: "No se pudieron obtener los eventos de tardeo" },
      { status: 500 }
    );
  }
}