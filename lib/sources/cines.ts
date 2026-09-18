import * as cheerio from "cheerio";

export type Pelicula = {
  titulo: string;
  duracion: string;
  genero: string;
  imagen: string;
  link: string;
  horarios: string[];
};

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function scrapeFlorida(): Promise<Pelicula[]> {
  const res = await fetch("https://www.reservaentradas.com/cine/alava/florida", {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    console.error(`reservaentradas Florida returned ${res.status}`);
    return [];
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const peliculas: Pelicula[] = [];

  $(".list-movies > .movie").each((_, el) => {
    const card = $(el);

    const linkEl = card.find(".title-movie-list a").filter("[href]").last();
    const titulo = linkEl.text().trim();
    if (!titulo) return;

    const link = linkEl.attr("href") || "";
    const imgEl = card.find(".caratula-cine img.lazy");
    const imagen = imgEl.attr("data-original") || imgEl.attr("src") || "";
    const duracion = card
      .find(".calificacion-list")
      .text()
      .replace(/\s+/g, " ")
      .trim();
    const genero = card
      .find(".event-description-short p b")
      .text()
      .replace(/\s+/g, " ")
      .trim();

    const horarios: string[] = [];
    card.find(".session-container a.sesion").each((_, a) => {
      const time = $(a).text().trim();
      if (/^\d{1,2}:\d{2}$/.test(time)) horarios.push(time);
    });

    if (horarios.length === 0) return;

    peliculas.push({
      titulo,
      duracion,
      genero,
      imagen,
      link,
      horarios: [...new Set(horarios)],
    });
  });

  return peliculas;
}