// app/api/cines/florida/route.ts
import { NextResponse } from "next/server";
import axios from "axios";
import * as cheerio from "cheerio";

export const runtime = "nodejs";
export const revalidate = 3600; // ISR

export async function GET() {
  try {
    const { data } = await axios.get<string>(
      "https://www.reservaentradas.com/cine/alava/florida",
      { timeout: 10000 } // 10 segundos
    );

    const $ = cheerio.load(data);
    const peliculas = $("div.movie-card")
      .map((_, el) => ({
        title: $(el).find("h2").text().trim(),
        horarios: $(el).find(".showtimes").text().trim(),
      }))
      .get();

    return NextResponse.json(peliculas);
  } catch (error) {
    console.error("Error al obtener datos de Cine Florida:", error);
    return NextResponse.json([]);
  }
}