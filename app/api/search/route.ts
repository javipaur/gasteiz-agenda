import { NextResponse } from "next/server";
import { getAgendaEventos } from "@/lib/agenda";
import { localDateStr } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchHit = {
  slug: string;
  title: string;
  date: string;
  image?: string;
  location?: string;
  category?: string;
};

export async function GET(req: Request) {
  try {
    const q = (new URL(req.url).searchParams.get("q") || "").trim().toLowerCase();
    if (q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const eventos = await getAgendaEventos();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const results: SearchHit[] = eventos
      .filter((ev) => {
        if (localDateStr(new Date(ev.date)) === localDateStr(today)) return true;
        return new Date(ev.date) >= new Date();
      })
      .filter((ev) => {
        const haystack = `${ev.title} ${ev.location || ""} ${ev.category || ""}`.toLowerCase();
        return q.split(/\s+/).every((term) => haystack.includes(term));
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 6)
      .map((ev) => ({
        slug: ev.slug,
        title: ev.title,
        date: ev.date,
        image: ev.image,
        location: ev.location,
        category: ev.category,
      }));

    return NextResponse.json({ results });
  } catch (error) {
    // **Un fallo ya no se disfraza de "no hay resultados".** Este `catch` devolvía
    // `{results: []}` con status 200 y sin mirar siquiera el error, y eso es
    // byte a byte lo mismo que la respuesta de una búsqueda que no encuentra
    // nada. El buscador de la cabecera —y el del móvil— pintaba "sin resultados" y
    // se paraba ahí, sin un status ni un log que dijera que el índice no se pudo
    // leer.
    //
    // 503 y no 500 a propósito: no es un error de este endpoint, es que la agenda
    // no estaba disponible en este momento, y el 503 es el código que un cliente
    // (o un proxy delante) sabe que puede reintentar. Es el mismo razonamiento que
    // el de los cines con 502, con 500 en el medio.
    //
    // Lo de dentro es raro pero no imposible: `getAgendaEventos` no lanza casi
    // nunca porque `aggregate` usa `allSettled`, pero la capa de caché de disco
    // sí lee y escribe ficheros, y un `JSON.parse` o un `stat` que fallara fuera de
    // su `try` se colaba hasta aquí.
    console.error("Error en /api/search:", error);
    return NextResponse.json(
      { error: "No se pudo buscar en la agenda" },
      { status: 503 }
    );
  }
}
