import * as cheerio from "cheerio";
import { DegradedSourceReadError, type SourceRunContext } from "../source-degraded";

const API_BASE = "https://helldorado.net/wp-json/wp/v2/evento";

const ES_MONTHS: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};

function parseSpanishDate(text: string): string | null {
  const m = text.match(/(\d{1,2})\s+de\s+(\w+)(?:\s+de\s+(\d{4}))?/i);
  if (!m) {
    const m2 = text.match(/(\d{1,2})\s+(\w+)/i);
    if (!m2) return null;
    const day = parseInt(m2[1], 10);
    const monthIdx = ES_MONTHS[m2[2].toLowerCase()];
    if (monthIdx === undefined) return null;
    const year = new Date().getFullYear();
    return `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const day = parseInt(m[1], 10);
  const monthIdx = ES_MONTHS[m[2].toLowerCase()];
  if (monthIdx === undefined) return null;
  const year = m[3] ? parseInt(m[3], 10) : new Date().getFullYear();
  return `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export interface HelldoradoEvent {
  title: string;
  date: string;
  image: string;
  location: string;
  link: string;
  description: string;
}

type FichaHelldorado = { date: string; image: string; description: string; ok: boolean };

async function scrapeEventPage(url: string): Promise<FichaHelldorado> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(10000),
      next: { revalidate: 86400 },
    });
    // El aviso importa más desde que la fecha ya no tiene reserva: si la ficha
    // falla, el evento no se descarta con una fecha inventada sino que **no
    // aparece**, y sin esto la única señal sería una cartelera más corta.
    if (!res.ok) {
      console.warn(`[helldorado] la ficha ${url} respondio ${res.status}`);
      return { date: "", image: "", description: "", ok: false };
    }
    const html = await res.text();
    const $ = cheerio.load(html);

    const dateText = $(".elementor-element-81becb8 .elementor-heading-title").text().trim();
    const date = parseSpanishDate(dateText) || "";
    if (!date) {
      console.warn(`[helldorado] la ficha ${url} no trae fecha legible: "${dateText}"`);
      // Fecha no legible/cambio de estructura en detalle: no es lectura sana de esta ficha.
      return { date: "", image: "", description: "", ok: false };
    }

    const img = $(".elementor-element-6a1c479 img").first().attr("src") || "";
    const image = img.startsWith("http") ? img : img ? `https://helldorado.net${img}` : "";

    const desc = $(".elementor-element-6ee8671 .elementor-widget-text-editor").text().trim().slice(0, 200);

    return { date, image, description: desc, ok: true };
  } catch (error) {
    console.warn(`[helldorado] fallo la ficha ${url}: ${error instanceof Error ? error.message : String(error)}`);
    return { date: "", image: "", description: "", ok: false };
  }
}

export async function scrapeHelldorado(ctx?: SourceRunContext): Promise<HelldoradoEvent[]> {
  const today = new Date().toISOString().slice(0, 10);
  const allEvents: { slug: string; title: string; link: string; postDate: string }[] = [];

  for (let page = 1; page <= 5; page++) {
    try {
      const res = await fetch(`${API_BASE}?per_page=50&page=${page}&orderby=date&order=desc&_fields=id,slug,title,link,date`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(15000),
        next: { revalidate: 3600 },
      });
      // Antes: `break` a secas. Un 500 en la página 1 devolvía `[]` sin decir
      // nada, y uno en la página 2 se quedaba con media cartelera sin decir nada
      // tampoco. Los dos son indistinguibles de "la sala no tiene nada", que es lo
      // único que el `[]` de esta función significaba.
      if (!res.ok) {
        // Página 1 fallida = no se pudo leer la fuente; páginas siguientes con datos
        // parciales también se tratan como fallo para no registrar ausencias falsas.
        throw new Error(`[helldorado] la pagina ${page} respondio ${res.status}`);
      }
      const data: any[] = await res.json();
      if (!data.length) break;
      allEvents.push(...data.map((e) => ({
        slug: e.slug,
        title: e.title?.rendered || "",
        link: e.link || "",
        postDate: (e.date || "").slice(0, 10),
      })));
      const totalPages = parseInt(res.headers.get("X-WP-TotalPages") || "1", 10);
      if (page >= totalPages) break;
    } catch (error) {
      const msg = `[helldorado] fallo la pagina ${page}: ${error instanceof Error ? error.message : String(error)}`;
      console.warn(msg);
      // Sin datos previos no hay lectura válida; con datos parciales tampoco
      // (evita tratar como sanos eventos no vistos en páginas no leídas).
      throw new Error(msg);
    }
  }

  const futureEvents = allEvents.filter((e) => e.postDate >= today || !e.postDate);
  const toScrape = futureEvents.slice(0, 40);

  const scraped = await Promise.allSettled(
    toScrape.map(async (e) => {
      const ficha = await scrapeEventPage(e.link);
      return {
        event: {
          title: e.title,
          // **Sin fecha de reserva.** Antes era `date || e.postDate`, y `postDate` es
          // el día en que se publicó el artículo en el WordPress, no el día del
          // concierto: si la ficha de detalle fallaba, el evento salía en la agenda
          // el día que se anunció. Eso incumple en silencio la norma que decidió
          // este proyecto —"una fuente sin fecha no entra en el registro", la misma
          // que sacó a Civitatis y Kora fuera del agregado—, y además metía el día
          // equivocado en el slug, que entonces no casaba con la ficha de detalle.
          //
          // Sin reserva, un evento sin fecha se queda sin fecha y el filtro de abajo
          // lo descarta: la lista es más corta, pero ninguno de los que están
          // tiene un día inventado.
          date: ficha.date,
          image: ficha.image,
          location: "Helldorado",
          link: e.link,
          description: ficha.description,
        },
        ok: ficha.ok,
      };
    })
  );

  const fulfilled = scraped
    .filter((r): r is PromiseFulfilledResult<{ event: HelldoradoEvent; ok: boolean }> => r.status === "fulfilled")
    .map((r) => r.value);
  const result = fulfilled.map((r) => r.event).filter((e) => e.title && e.date);
  const fichasFallidas = fulfilled.filter((r) => !r.ok).length;

  // Si había fichas a revisar y no se obtuvo ninguna con fecha válida, probable
  // cambio/bloqueo en páginas de detalle: no se trata como lectura sana vacía.
  if (toScrape.length > 0 && result.length === 0) {
    throw new Error(
      "[helldorado] se encontraron entradas pero no se pudo extraer ninguna fecha de evento válida"
    );
  }

  // Fichas no leídas/parseadas = lectura parcial: no confirmar ausencias de lo perdido.
  if (ctx?.strict && fichasFallidas > 0) {
    throw new DegradedSourceReadError(
      "helldorado",
      `${fichasFallidas} de ${toScrape.length} fichas no leídas o sin fecha válida`,
      result
    );
  }

  return result;
}
