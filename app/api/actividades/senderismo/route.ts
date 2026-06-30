// app/api/cm-gazteiz/route.ts
import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

const BASE_URL = "https://www.cm-gazteiz.com";
const URL = `${BASE_URL}/actividades/`;

// Cache en memoria
let cache: Actividad[] | null = null;
let lastFetch = 0;
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24h

export type Actividad = {
  title: string;
  date: string;       // ISO string
  link: string;
  image: string;
  category: "excursiones";
  location: string;
};

function parseFechaISO(fecha?: string): string {
  if (!fecha) return new Date().toISOString();
  try {
    const parts = fecha.split("/").map(Number);
    if (parts.length === 3) {
      const [d, m, y] = parts;
      return new Date(y, m - 1, d).toISOString();
    }
    const d = new Date(fecha);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

export async function GET() {
  const now = Date.now();

  if (cache && now - lastFetch < CACHE_TTL) {
    return NextResponse.json({
      source: "cm-gazteiz",
      category: "actividades",
      count: cache.length,
      data: cache,
      cached: true,
    });
  }

  try {
    const resp = await fetch(URL, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!resp.ok) {
      return NextResponse.json({ error: "Error al cargar la web" }, { status: resp.status });
    }

    const html = await resp.text();
    const $ = cheerio.load(html);

    const actividades: Actividad[] = [];

    $("article").each((_, el) => {
      const $el = $(el);

      const title = $el.find(".title-text a").text().trim() || "Sin título";
      if (!title) return;

      const linkRaw = $el.find(".title-text a").attr("href") || "";
      const link = linkRaw.startsWith("http") ? linkRaw : `${BASE_URL}${linkRaw}`;

      const dateRaw = $el.find(".meta-calander").attr("title") || $el.find(".meta-time").text().trim();
      const date = parseFechaISO(dateRaw);

      let image = $el.find("figure.hover-img img").attr("src") || "";
      if (image && !image.startsWith("http")) image = `${BASE_URL}${image.startsWith("/") ? "" : "/"}${image}`;
      if (!image) image = "https://via.placeholder.com/400x300.png?text=Evento";

      actividades.push({
        title,
        date,
        link,
        image,
        category: "excursiones",   // para filtro en SportPageClient
        location: "Gazteiz",        // ubicación fija o extraer de la web si quieres
      });
    });

    actividades.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    cache = actividades;
    lastFetch = now;

    return NextResponse.json({
      source: "cm-gazteiz",
      category: "actividades",
      count: actividades.length,
      data: actividades,
      cached: false,
    });
  } catch (error) {
    console.error("❌ Error scraping cm-gazteiz:", error);
    if (cache) {
      return NextResponse.json({
        source: "cm-gazteiz",
        category: "actividades",
        count: cache.length,
        data: cache,
        cached: true,
        warning: "fallback cache",
      });
    }
    return NextResponse.json({ error: "No se pudieron obtener las actividades" }, { status: 500 });
  }
  
}