import { NextResponse } from "next/server";
import { scrapeMunicipalCalendar } from "@/lib/sources/municipal";

export async function GET() {
  try {
    const eventos = await scrapeMunicipalCalendar({ calendariosID: 168 });
    return NextResponse.json(eventos);
  } catch (error) {
    return NextResponse.json(
      { error: "Error al consultar eventos" },
      { status: 500 }
    );
  }
}
