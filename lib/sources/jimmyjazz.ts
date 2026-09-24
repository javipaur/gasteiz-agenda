import * as cheerio from "cheerio";

const SPANISH_MONTHS: Record<string, string> = {
  ene: "01",
  feb: "02",
  mar: "03",
  abr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  ago: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dic: "12",
};

function isoDate(day: string, month: string, year: string): string {
  const dd = day.trim();
  const yy = year.trim();
  if (!/^\d{1,2}$/.test(dd) || !/^\d{4}$/.test(yy)) return "";
  const mm = SPANISH_MONTHS[month.trim().toLowerCase().slice(0, 3)];
  if (!mm) return "";
  return `${yy}-${mm}-${dd.padStart(2, "0")}`;
}

export async function scrapeJimmyJazz(): Promise<any[]> {
  const res = await fetch(
    "https://sarrerak.jimmyjazzgasteiz.com/web/?menu=36&pagina=&siteID=jimmyjazz",
    {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    }
  );

  const buffer = Buffer.from(await res.arrayBuffer());
  const html = buffer.toString("latin1");
  const $ = cheerio.load(html);

  const events: any[] = [];

  $(".mkp-ticket-item").each((_, el) => {
    const title = $(el).find(".mkp-ticket-data-title").text().trim();
    const day = $(el).find(".mkp-ticket-date-monthday").text().trim();
    const month = $(el).find(".mkp-ticket-date-month").text().trim();
    const year = $(el).find(".mkp-ticket-date-year").text().trim();
    const place = $(el).find(".mkp-ticket-data-place").text().trim();
    const image = $(el).find(".mkp-ticket-image img").attr("src");
    const ticketLink = $(el).find("a.btn").attr("href");

    const date = isoDate(day, month, year);
    if (!date) return;

    events.push({
      title,
      date,
      location: place,
      image: image ? `https://sarrerak.jimmyjazzgasteiz.com${image}` : undefined,
      link: ticketLink,
    });
  });

  return events;
}
