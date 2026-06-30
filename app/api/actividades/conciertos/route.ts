import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function GET(request: Request) {
 // const apiKey = request.headers.get("Authorization");
 /* if (!apiKey || apiKey !== process.env.API_KEY) {
    return new Response(
      JSON.stringify({ error: "No autorizado" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }*/
  try {
    const res = await fetch(
      "https://sarrerak.jimmyjazzgasteiz.com/web/?menu=36&pagina=&siteID=jimmyjazz",
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
        cache: "no-store",
      }
    );

    const buffer = Buffer.from(await res.arrayBuffer());
    const html = buffer.toString("latin1"); // 👈 clave para evitar �

    const $ = cheerio.load(html);

    const events: any[] = [];

    $(".mkp-ticket-item").each((_, el) => {
      const title = $(el).find(".mkp-ticket-data-title").text().trim();

      const weekday = $(el).find(".mkp-ticket-date-weekday").text().trim();
      const day = $(el).find(".mkp-ticket-date-monthday").text().trim();
      const month = $(el).find(".mkp-ticket-date-month").text().trim();
      const year = $(el).find(".mkp-ticket-date-year").text().trim();

      const place = $(el).find(".mkp-ticket-data-place").text().trim();

      const image = $(el).find(".mkp-ticket-image img").attr("src");

      const ticketLink = $(el).find("a.btn").attr("href");

      events.push({
        title,
        date: `${weekday} ${day} ${month} ${year}`,
        location:place,
        image: image
          ? `https://sarrerak.jimmyjazzgasteiz.com${image}`
          : null,
        link:ticketLink,
      });
    });

    return NextResponse.json(events);
  } catch (error) {
    return NextResponse.json(
      { error: "Scraping failed", details: error },
      { status: 500 }
    );
  }
}