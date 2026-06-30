// app/api/farmacias/route.js
import axios from 'axios';
import * as cheerio from 'cheerio';

export async function GET(request: Request) {
 // const apiKey = request.headers.get("Authorization");
  /*if (!apiKey || apiKey !== process.env.API_KEY) {
    return new Response(
      JSON.stringify({ error: "No autorizado" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }*/
  try {
    const url = 'https://cofalava.org/farmacias-de-guardia/';
    const { data } = await axios.get<string>(url);

    const $ = cheerio.load(data);
    const farmacias: { nombre: string; direccion: string; ciudad: string; telefono: string; horario: string; }[] = [];

    $('.wpgmp_locations li.fc-component-text').each((i, elem) => {
      const nombre = $(elem).find('.place_title').text().trim();
      const direccion = $(elem).find('.ft-td').eq(1).text().trim();
      const ciudad = $(elem).find('.ft-td').eq(2).text().trim();
      const telefono = $(elem).find('.ft-td').eq(3).text().trim();
      const horario = $(elem).find('.ft-td').eq(4).text().trim();

      farmacias.push({ nombre, direccion, ciudad, telefono, horario });
    });

    return new Response(JSON.stringify(farmacias), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
