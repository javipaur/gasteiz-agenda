import * as cheerio from "cheerio";

export type Pelicula = {
  titulo: string;
  /**
   * **Siempre vacia en Boulevard.** No es un selector mal puesto: la pagina del
   * cine de Sensacine no publica la duracion. Medido sobre el HTML en vivo, 0
   * coincidencias de `\d+ min` en 397 KB, y un unico `duration` que es otro
   * uso. Florida si la trae, de `.calificacion-list`.
   *
   * Se queda vacia a proposito en vez de inventarse o de pedir una peticion mas
   * por pelicula a la ficha. Si algun dia se quiere de verdad, hay que sacarla
   * de `sensacine.com/peliculas/<id>`, y eso son 17 peticiones por scrape.
   */
  duracion: string;
  genero: string;
  imagen: string;
  link: string;
  horarios: string[];
};

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * Falla hacia arriba en vez de devolver una lista vacia.
 *
 * Antes usaba `axios` y por eso el scraper era in-testable con la convencion del
 * repo (`mockFetchWith` solo intercepta `global.fetch`) y no tenia ni un test:
 * era el unico de los dos scrapers de cine sin cobertura, y eso hacia que un
 * error aqui saliera como "no hay peliculas" en vez de como un fallo.
 *
 * Ahora usa `fetch`, igual que `lib/sources/cines.ts`, y propaga el error. El
 * contrato con la app movil no cambia en el camino feliz: sigue recibiendo
 * `{url, scrapedAt, total, peliculas}`. Lo que cambia es el camino de error, que
 * pasa de un 200 con lista vacia a un 502, y asi el cliente puede distinguir
 * "hoy no hay nada" de "la fuente no respondio".
 */
export async function scrapeBoulevard(): Promise<Pelicula[]> {
  const res = await fetch("https://www.sensacine.com/cines/cine/E0786/", {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`sensacine Boulevard returned ${res.status}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const peliculas: Pelicula[] = [];

  $(".movie-card-theater").each((_, el) => {
    const card = $(el);
    const titulo = card.find(".meta-title-link").text().trim();
    const img = card.find("img.thumbnail-img");
    const imagen = img.attr("data-src") || img.attr("src") || "";

    const metaText = card.find(".meta-body-info").text().trim();
    const genero = (metaText.split("|").pop()?.split("/")[0]?.trim() || "").replace(/\s+/g, " ");

    const horarios: string[] = [];
    let link = "";

    card.find(".showtimes-hour-item.bookable").each((_, span) => {
      const time = $(span).find(".showtimes-hour-item-value").text().trim();
      if (time) horarios.push(time);
      const cls = $(span).attr("class") || "";
      if (!link) {
        const urlMatch = cls.match(/ACr[^ ]+/);
        if (urlMatch) {
          try { link = decodeUrl(urlMatch[0]); } catch { /* fallback */ }
        }
      }
    });

    if (titulo && horarios.length > 0) {
      peliculas.push({
        titulo,
        duracion: "",
        // Sin punto final forzado. El codigo hacia `genero.replace(/\.$/, "") + "."`,
        // y con el genero vacio eso no deja el campo a vacio: deja `"."`, un
        // punto suelto que la app pinta como si fuera el genero. Florida
        // devuelve el texto tal cual, y tampoco garantiza punto, asi que
        // quitarlo aqui tambien quita la contradiccion entre los dos cines.
        genero,
        imagen,
        link,
        // Deduplicado como en Florida (`lib/sources/cines.ts`): una misma hora
        // aparece una vez por cada modo de visionado, y sin `Set` salia
        // repetida en la lista de sesiones.
        horarios: [...new Set(horarios)],
      });
    }
  });

  return peliculas;
}

function decodeUrl(className: string): string {
  const parts = className.split("ACr");
  const combined = parts.join("");
  const buf = Buffer.from(combined, "base64");
  return buf.toString("utf-8");
}
