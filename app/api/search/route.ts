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
  } catch {
    return NextResponse.json({ results: [] }, { status: 200 });
  }
}
