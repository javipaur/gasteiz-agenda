import { NextResponse } from "next/server";
import axios from "axios";
import * as cheerio from "cheerio";

export async function GET(request: Request) {
  try {
    const { data } = await axios.get<string>(
      "https://www.buscametas.com/inscripciones/",
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; NextScraper/1.0)",
        },
      }
    );

    const $ = cheerio.load(data);
    const eventos: {
      title: string;
      date: string;
      location: string;
      link: string;
      image: string;
    }[] = [];

    $("tr.card").each((_, el) => {
      const row = $(el);
      const title = row.find(".card-heading-title").text().trim();
      const date = row.find(".card-date").text().trim();
      const location = row.find(".card-location span").text().trim();
      const link =
        row.find(".card-link a").attr("href")?.trim() ?? "";
      const rawImage =
        row.find(".card-img-top img").attr("src")?.trim() ?? "";
      const image = rawImage
        ? rawImage.startsWith("http")
          ? rawImage
          : `https://www.buscametas.com${rawImage.startsWith("/") ? "" : "/"}${rawImage}`
        : "";

      eventos.push({
        title,
        date,
        location,
        link: link
          ? `https://www.buscametas.com${link.startsWith("/") ? "" : "/"}${link}`
          : "",
        image,
      });
    });

    eventos.sort((a, b) => {
      const dateA = new Date(
        a.date.split("-")[0].trim().split("/").reverse().join("-")
      );
      const dateB = new Date(
        b.date.split("-")[0].trim().split("/").reverse().join("-")
      );
      return dateA.getTime() - dateB.getTime();
    });

    return NextResponse.json({ eventos });
  } catch (error) {
    console.error("Error scraping inscripciones:", error);
    return NextResponse.json(
      { error: "No se pudieron obtener los eventos" },
      { status: 500 }
    );
  }
}
