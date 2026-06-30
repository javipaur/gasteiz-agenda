import { NextResponse } from "next/server";
import { scrapeBuscametasCalendario } from "@/lib/sources/buscametas";

export async function GET() {
  try {
    const eventos = await scrapeBuscametasCalendario();
    return NextResponse.json({ eventos });
  } catch (error) {
    console.error("Error fetching carreras Alava:", error);
    return NextResponse.json(
      { error: "No se pudieron obtener las carreras" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const params = {
      zona: body.zona || "alava",
      especial: body.especial || "",
      anteriores: body.anteriores || "",
      distancia_min: body.distancia_min || "0",
      distancia_max: body.distancia_max || "100",
      desde: body.desde || new Date().toISOString().split("T")[0],
      rangeInputModal: body.rangeInputModal || "50",
      idioma: body.idioma || "ES",
    };

    const target = new URL(
      "https://www.buscametas.com/modulos/calendario/fuentes/get_eventos.php"
    );
    Object.entries(params).forEach(([key, value]) =>
      target.searchParams.append(key, value)
    );

    const resp = await fetch(target.toString(), { method: "GET" });
    if (!resp.ok)
      return NextResponse.json(
        { error: "Error desde API externa" },
        { status: resp.status }
      );

    const data = await resp.json();
    const eventos = (data.eventos || []).map((e: any) => ({
      title: e.nombre,
      date: e.fecha_ini
        ? new Date(e.fecha_ini).toISOString()
        : new Date().toISOString(),
      image: e.imagen,
      location: `${e.poblacion}${e.prov ? ` ${e.prov}` : ""}`,
      link: e.web || "#",
    }));

    return NextResponse.json({ eventos });
  } catch (error) {
    console.error("Error en POST /api/eventos:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
