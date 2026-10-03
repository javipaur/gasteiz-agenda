import * as cheerio from "cheerio";

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

async function scrapeEventPage(url: string): Promise<{ date: string; image: string; description: string }> {
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
      return { date: "", image: "", description: "" };
    }
    const html = await res.text();
    const $ = cheerio.load(html);

    const dateText = $(".elementor-element-81becb8 .elementor-heading-title").text().trim();
    const date = parseSpanishDate(dateText) || "";
    if (!date) {
      console.warn(`[helldorado] la ficha ${url} no trae fecha legible: "${dateText}"`);
    }

    const img = $(".elementor-element-6a1c479 img").first().attr("src") || "";
    const image = img.startsWith("http") ? img : img ? `https://helldorado.net${img}` : "";

    const desc = $(".elementor-element-6ee8671 .elementor-widget-text-editor").text().trim().slice(0, 200);

    return { date, image, description: desc };
  } catch (error) {
    console.warn(`[helldorado] fallo la ficha ${url}: ${error instanceof Error ? error.message : String(error)}`);
    return { date: "", image: "", description: "" };
  }
}

export async function scrapeHelldorado(): Promise<HelldoradoEvent[]> {
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
        console.warn(`[helldorado] la pagina ${page} respondio ${res.status}, se corta la paginacion`);
        break;
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
      console.warn(`[helldorado] fallo la pagina ${page}: ${error instanceof Error ? error.message : String(error)}`);
      break;
    }
  }

  const futureEvents = allEvents.filter((e) => e.postDate >= today || !e.postDate);
  const toScrape = futureEvents.slice(0, 40);

  const scraped = await Promise.allSettled(
    toScrape.map(async (e) => {
      const { date, image, description } = await scrapeEventPage(e.link);
      return {
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
        date,
        image,
        location: "Helldorado",
        link: e.link,
        description,
      };
    })
  );

  return scraped
    .filter((r): r is PromiseFulfilledResult<HelldoradoEvent> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((e) => e.title && e.date);
}
