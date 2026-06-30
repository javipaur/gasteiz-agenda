import axios from "axios";
import * as cheerio from "cheerio";

export type Pelicula = {
  titulo: string;
  duracion: string;
  genero: string;
  imagen: string;
  link: string;
  horarios: string[];
};

function decodeUrl(className: string): string {
  const parts = className.split("ACr");
  const combined = parts.join("");
  const buf = Buffer.from(combined, "base64");
  return buf.toString("utf-8");
}

export async function scrapeBoulevard(): Promise<Pelicula[]> {
  const { data } = await axios.get<string>(
    "https://www.sensacine.com/cines/cine/E0786/",
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      timeout: 15000,
    }
  );

  const $ = cheerio.load(data);
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
        genero: genero.replace(/\.$/, "") + ".",
        imagen,
        link,
        horarios,
      });
    }
  });

  return peliculas;
}
