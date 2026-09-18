import { NextResponse } from "next/server";
import { getAgendaEventos } from "@/lib/agenda";

const TOUR_CATEGORIES = /excursiones|senderismo|visitas|tours/;
const BAD_CATEGORIES =
  /conciertos|concierto|m[uú]sica|teatro|dan[ií]a|cine|pel[ií]cula|exposici[oó]n|infantil|conferencia|charla|literatura|poes/i;
const TOUR_TITLE =
  /excursi[oó]n|visita\s+guia\w*|visita|ruta|senderismo|patrimonio|tour/i;

export async function GET() {
  try {
    const agenda = await getAgendaEventos({ days: 365 });
    const tours = agenda
      .filter((e) => {
        const categoria = (e.category || "").toLowerCase();
        if (BAD_CATEGORIES.test(categoria)) return false;
        if (TOUR_CATEGORIES.test(categoria)) return true;
        return TOUR_TITLE.test(e.title);
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 50);

    return NextResponse.json({
      source: "agregado",
      category: "tours",
      count: tours.length,
      data: tours,
    });
  } catch (error) {
    console.error("Error obteniendo tours:", error);
    return NextResponse.json(
      { error: "No se pudieron obtener los tours" },
      { status: 500 }
    );
  }
}