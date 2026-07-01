import axios from "axios";
import FormData from "form-data";
import * as cheerio from "cheerio";

type BuscametasEvento = {
  title: string;
  date: string;
  image: string;
  location: string;
  link: string;
};

function transformarEventos(apiEventos: any[]): BuscametasEvento[] {
  return apiEventos.map((e: any) => ({
    title: e.nombre,
    date: e.fecha_ini ? new Date(e.fecha_ini).toISOString() : new Date().toISOString(),
    image: e.imagen,
    location: `${e.poblacion}${e.prov ? ` ${e.prov}` : ""}`,
    link: e.web || "#",
  })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export async function scrapeBuscametasCalendario(): Promise<BuscametasEvento[]> {
  const data = new FormData();
  data.append("zona", "alava");
  data.append("distancia_min", "0");
  data.append("distancia_max", "100");
  data.append("desde", new Date().toISOString().split("T")[0]);
  data.append("rangeInputModal", "50");
  data.append("idioma", "ES");

  const response = await axios.post(
    "https://www.buscametas.com/modulos/calendario/fuentes/get_eventos.php",
    data,
    { headers: data.getHeaders() }
  );

  return transformarEventos((response.data as { eventos: any[] }).eventos);
}

export async function scrapeBuscametasInscripciones(): Promise<any[]> {
  const { data } = await axios.get<string>(
    "https://www.buscametas.com/inscripciones/",
    {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; NextScraper/1.0)",
      },
    }
  );

  const $ = cheerio.load(data);
  const eventos: any[] = [];

  $("tr.card").each((_, el) => {
    const row = $(el);
    const title = row.find(".card-heading-title").text().trim();
    const date = row.find(".card-date").text().trim();
    const location = row.find(".card-location span").text().trim();
    const link = row.find(".card-link a").attr("href")?.trim() ?? "";
    const rawImage = row.find(".card-img-top img").attr("src")?.trim() ?? "";
    const image = rawImage
      ? rawImage.startsWith("http")
        ? rawImage
        : `https://www.buscametas.com${rawImage.startsWith("/") ? "" : "/"}${rawImage}`
      : "";

    eventos.push({
      title,
      date,
      location,
      link: link ? `https://www.buscametas.com${link.startsWith("/") ? "" : "/"}${link}` : "",
      image,
    });
  });

  eventos.sort((a, b) => {
    const dateA = new Date(a.date.split("-")[0].trim().split("/").reverse().join("-"));
    const dateB = new Date(b.date.split("-")[0].trim().split("/").reverse().join("-"));
    return dateA.getTime() - dateB.getTime();
  });

  return eventos;
}
