import * as cheerio from "cheerio";

/**
 * Tope del cuerpo de la respuesta, en bytes.
 *
 * El plazo acota cuánto se espera, no cuánto se acepta: `arrayBuffer()` entero
 * descarga primero y pregunta después, así que un cuerpo enorme —o una respuesta
 * que se atasca a mitad— se lo come entero antes de que el parser la mire. La
 * cartelera real ronda los 87 KB, de modo que 2 MB son unas veinte veces su
 * tamaño y holgura de sobra para que la sala añada eventos.
 *
 * No se mira solo la cabecera `content-length`: no todos los servidores la
 * mandan, y los que la mandan pueden mentir. El corte está en el propio stream.
 */
const MAX_HTML_BYTES = 2 * 1024 * 1024;

async function leerConTope(res: Response, maxBytes: number): Promise<Buffer> {
  const declarado = Number(res.headers.get("content-length") || "0");
  if (declarado > maxBytes) {
    throw new Error(`jimmyjazz body of ${declarado} bytes exceeds ${maxBytes}`);
  }

  const cuerpo = res.body;
  if (!cuerpo) return Buffer.from(await res.arrayBuffer());

  const lector = cuerpo.getReader();
  const trozos: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await lector.cancel();
      throw new Error(`jimmyjazz body exceeds ${maxBytes} bytes`);
    }
    trozos.push(value);
  }

  return Buffer.concat(trozos);
}

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
  try {
    const res = await fetch(
      "https://sarrerak.jimmyjazzgasteiz.com/web/?menu=36&pagina=&siteID=jimmyjazz",
      {
        headers: { "User-Agent": "Mozilla/5.0" },
        cache: "no-store",
        // El plazo y el tope de tamaño son la misma decisión por los dos lados: sin
        // plazo, una respuesta que no llega cuelga `Promise.allSettled` en
        // `lib/agenda.ts`; sin tope, una que llega enorme se come la memoria del
        // proceso antes de que el parser la mire. Aquí no se cambia el contrato de
        // "devuelve lista vacía" que ya tenía, lo que se añade es el motivo.
        signal: AbortSignal.timeout(20000),
      }
    );

    const buffer = await leerConTope(res, MAX_HTML_BYTES);
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
  } catch (error) {
    // Antes esto se comía el fallo en silencio y devolvía una lista vacía
    // indistinguible de "la sala no tiene nada cartelado", que es el mismo
    // agujero que cerró `municipal.ts` propagando. Aquí no se propaga porque no
    // es el contrato de esta fuente, pero sí se dice qué pasó.
    console.error(`[jimmyjazz] ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}
