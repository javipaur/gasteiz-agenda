// app/api/carreras-alava/route.ts
import { NextResponse } from "next/server";
import axios from "axios";
import FormData from "form-data";
import moment from "moment";

type Evento = {
  title: string;
  date: string;
  image: string;
  location: string;
  link: string;
  category: "agenda" | "teatro";
};

// Helper para transformar la respuesta externa
function transformarEventos(apiEventos: any[]): Evento[] {
  return apiEventos.map((e: any) => ({
    title: e.nombre,
    date: e.fecha_ini ? new Date(e.fecha_ini).toISOString() : new Date().toISOString(),
    image: e.imagen ,
    location: `${e.poblacion}${e.prov ? ` ${e.prov}` : ""}`,
    link: e.web || "#",
    category: "agenda" as "agenda" | "teatro", // <-- aquí forzamos que sea del tipo literal
  })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// GET: busca eventos por defecto (Alava)
export async function GET(request: Request) {
  try {
    const data = new FormData();
    data.append("zona", "alava");
    data.append("distancia_min", "0");
    data.append("distancia_max", "100");
    data.append("desde", moment().format("YYYY-MM-DD"));
    data.append("rangeInputModal", "50");
    data.append("idioma", "ES");

    const response = await axios.post(
      "https://www.buscametas.com/modulos/calendario/fuentes/get_eventos.php",
      data,
      { headers: data.getHeaders() }
    );

    const eventos = transformarEventos((response.data as { eventos: any[] }).eventos);
    return NextResponse.json({ eventos });

  } catch (error) {
    console.error("❌ Error fetching carreras Alava:", error);
    return NextResponse.json({ error: "No se pudieron obtener las carreras" }, { status: 500 });
  }
}

// POST: busca eventos con parámetros personalizados
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const params = {
      zona: body.zona || 'alava',
      especial: body.especial || '',
      anteriores: body.anteriores || '',
      distancia_min: body.distancia_min || '0',
      distancia_max: body.distancia_max || '100',
      desde: body.desde || moment().format("YYYY-MM-DD"),
      rangeInputModal: body.rangeInputModal || '50',
      idioma: body.idioma || 'ES',
    };

    const target = new URL('https://www.buscametas.com/modulos/calendario/fuentes/get_eventos.php');
    Object.entries(params).forEach(([key, value]) => target.searchParams.append(key, value));

    const resp = await fetch(target.toString(), { method: 'GET' });
    if (!resp.ok) return NextResponse.json({ error: 'Error desde API externa' }, { status: resp.status });

    const data = await resp.json();
    const eventos = transformarEventos(data.eventos);

    return NextResponse.json({ eventos });

  } catch (error) {
    console.error('Error en POST /api/eventos:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}