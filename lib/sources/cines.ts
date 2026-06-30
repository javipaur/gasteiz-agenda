import axios from "axios";
import * as cheerio from "cheerio";

export async function scrapeFlorida(): Promise<any[]> {
  const { data } = await axios.get<string>(
    "https://www.reservaentradas.com/cine/alava/florida",
    { timeout: 10000 }
  );

  const $ = cheerio.load(data);
  const peliculas = $("div.movie-card")
    .map((_, el) => ({
      title: $(el).find("h2").text().trim(),
      horarios: $(el).find(".showtimes").text().trim(),
    }))
    .get();

  return peliculas;
}
