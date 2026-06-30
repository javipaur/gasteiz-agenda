// app/api/eventos/route.ts
import { NextResponse } from 'next/server';

const BASE_IMAGE_URL = 'https://www.vitoria-gasteiz.org';

function normalizeEvento(e: any) {
  const rawImage = e?.imagenDestacada || e?.imagen || null;
  const image = rawImage
    ? rawImage.startsWith('http')
      ? rawImage
      : `${BASE_IMAGE_URL}${rawImage}`
    : null;

  return {
    id: e?.codigo || crypto.randomUUID(),
    title: e?.titulo || 'Sin título',
    description: e?.descripcion || e?.resumen || '',
    date: e?.fechaInicio || null,
    image,
    link: e?.url || e?.linkDetalle || null,
    category: 'eventos',
    source: 'vitoria-gasteiz',
    tipo: e?.tipo || null,
    dest: e?.dest || null,
  };
}

export async function GET(request: Request) {
 // const apiKey = request.headers.get("Authorization");
 /* if (!apiKey || apiKey !== process.env.API_KEY) {
    return new Response(
      JSON.stringify({ error: "No autorizado" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }*/
  try {
    const hoy = new Date();
    const inicio = new Date(hoy);
    inicio.setHours(0, 0, 0, 0);
    const fin = new Date(hoy);
    fin.setFullYear(fin.getFullYear() + 1);
    fin.setHours(23, 59, 59, 999);

    const fd = inicio.getTime();
    const fh = fin.getTime();
    const url = `https://www.vitoria-gasteiz.org/wb021/was/CalendarioServlet?accion=buscar&idioma=es&claveArea=&claveTema=&calendariosID=566&t=&fd=${fd}&fh=${fh}&deCM=false&moEx=false&f=`;

     const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);

    const data = await res.json();
    const resultados = (data?.resultados || []).map(normalizeEvento);

    return NextResponse.json({
      source: 'vitoria-gasteiz',
      category: 'eventos',
      count: resultados.length,
      data: resultados,
    });
  } catch (error) {
    console.error('❌ Error al obtener eventos:', error);
    return NextResponse.json(
      { error: 'Error al consultar eventos' },
      { status: 500 }
    );
  }
}


