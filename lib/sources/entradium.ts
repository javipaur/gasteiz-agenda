import * as cheerio from "cheerio";
import { localDateKey } from "@/lib/slug";

export interface EntradiumEvent {
  title: string;
  date: string;
  image: string;
  location: string;
  link: string;
  price: string;
}

const HOME_URL = "https://m.entradium.com/es";
const USER_AGENT_MOBILE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const MONTHS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

function strip(value: string): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

/**
 * El día de hoy **local**, que es lo que ve la persona.
 *
 * Dos horas al día estos dos no son lo mismo, y la culpa es del huso:
 *
 *     instante (Z)          toISOString()   día local Madrid
 *     2027-03-15T22:30Z     2027-03-15     2027-03-15   (invierno, +01:00)
 *     2027-03-15T23:30Z     2027-03-15     2027-03-16   <-- difieren
 *     2027-07-15T22:30Z     2027-07-15     2027-07-16   <-- difieren
 *
 * Medido en `TZ=Europe/Madrid`. La ventana es de **dos horas** en invierno y en
 * verano —de 00:00 a 01:59 locales— porque son las dos horas en las que el día local
 * ya ha cambiado y el del prefijo ISO todavía no: el primero en cruzar es el UTC, a
 * las 23:00Z en invierno y a las 22:00Z en verano.
 *
 * El resto del fichero ya no usa `toISOString()` para esto: la fecha de una etiqueta
 * se construye a **mediodía UTC** y se formatea con las partes en UTC, y el filtro
 * usa esto de aquí. Lo que queda con el patrón viejo son los dos sitios de abajo.
 */
function hoyLocal(): string {
  // `localDateKey` y no un `getFullYear()/getMonth()/getDate()` a mano: es la misma
  // función que usa `lib/agenda.ts` para la clave de dedupe, así que "el día que ve
  // el usuario" tiene una sola definición en el repo y no dos que se puedan separar.
  return localDateKey(new Date().toISOString());
}

function parseDate(label: string): string {
  // "Varias fechas": evento recurrente en curso → se fija al día actual.
  //
  // Antes era `new Date().toISOString().slice(0, 10)`, que entre las 00:00 y las
  // 01:59 de Madrid es **ayer**. Y eso no era un detalle de una etiqueta: el
  // `date` devuelto es el que filtra `lib/agenda.ts` con `new Date(ev.date) >= hoy`,
  // así que un evento recurrente que empezaba esta madrugada se fechaba en el día
  // anterior y **no aparecía en la agenda, en la home ni en el digest** hasta que
  // pasaban las dos. Para un "Varias fechas" el día es lo único que hay, así que
  // durante esas dos horas la agenda no tenía ninguna cita recurrente de las que sí
  // se anuncian, y nadie veía por qué.
  if (/varias\s*(fechas?|d[ií]as)|several dates/i.test(label)) {
    return hoyLocal();
  }

  // Formato visto: "26 sep" (año actual salvo fechas ya pasadas)
  const year = new Date().getFullYear();
  const m = label.toLowerCase().match(/(\d{1,2})\s*(?:de\s*)?([a-z]{2,})/i);
  if (!m) return "";

  const day = parseInt(m[1], 10);
  const monthStr = m[2].slice(0, 3).replace(/\.$/, "");
  const monthIdx = MONTHS.indexOf(monthStr);
  if (!day || monthIdx === -1) return "";

  const month = monthIdx + 1;
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  // **Mediodía UTC**, y no medianoche local: es el patrón de
  // `lib/sources/miniature.ts:137` y está aquí por un motivo concreto. Antes se
  // construía con `new Date(year, month-1, day)` —medianoche **local**— y se
  // devolvía con `date.toISOString().slice(0, 10)`, que es el día **UTC**. En
  // Europe/Madrid la medianoche local son las 22:00 o las 23:00 del día anterior,
  // de modo que el cambio de día pasaba primero y **todos** los eventos salían un
  // día antes: "26 sep" → `2027-09-25`, "15 oct" → `2026-10-14`, "1 nov" →
  // `2026-10-31`.
  //
  // No era solo una fecha fea. `lib/agenda.ts:164` filtra con
  // `new Date(ev.date) >= hoy`, así que un concierto del sábado aparecía el
  // viernes y desaparecía de la agenda, de la home y del digest durante el día
  // real — y el del día en sí se filtraba entero, porque quedaba fechado en
  // ayer. Y como el slug lleva la fecha dentro, tampoco casaba con la ficha.
  //
  // A las 12:00 UTC el día local y el UTC son el mismo y quedan doce horas de
  // margen en las dos direcciones, así que el día no puede cambiar por el cambio
  // de hora ni al pasar un mes.
  const date = new Date(`${iso}T12:00:00Z`);

  // Si ya pasó (salvo enero/diciembre cerca del fin de año) asumo año siguiente
  if (date.getTime() < Date.now() && month >= 6) {
    date.setUTCFullYear(year + 1);
  }

  // Se formatea con las partes **en UTC** y no con `toISOString()` sobre un
  // objeto local: el día ya está fijado a mediodía UTC, así que leerlo en UTC es
  // lo que hace que la cadena devuelta y el día que el usuario ve sean el mismo.
  return `${date.getUTCFullYear()}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export async function scrapeEntradium(): Promise<EntradiumEvent[]> {
  const res = await fetch(HOME_URL, {
    headers: { "User-Agent": USER_AGENT_MOBILE },
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) {
    console.error(`Entradium returned ${res.status}`);
    return [];
  }

  const html = await res.text();
  const $ = cheerio.load(html);
  const events: EntradiumEvent[] = [];
  // Local y no con `toISOString().slice(0, 10)`. **Medido, no supuesto**, porque el
  // síntoma va en la dirección contraria al que se espera y por eso no se ve: entre
  // las 00:00 y las 01:59 locales el prefijo ISO está **un día por detrás**, así que
  // `date < today` se quedaba corto y no descartaba nada. Con el filtro viejo, a las
  // 00:30 del día 16:
  //
  //     fecha        viejo        nuevo
  //     2027-03-14   descarta     descarta
  //     2027-03-15   deja         descarta   <-- ayer local se colaba
  //     2027-03-16   deja         deja
  //
  // No es un bug de un día suelto: son los eventos del día anterior los que se
  // cuelan, y en una fuente que publica sobre todo lo que viene, la lista de "hoy y
  // siguientes" empezaba siempre con el programa de ayer. La fecha que produce
  // `parseDate` es **local** —la etiqueta "26 sep" es el 26 de septiembre en el
  // calendario de quien la lee—, así que compararla contra un día UTC no tiene
  // sentido ni siquiera "a veces".
  const today = hoyLocal();

  $("a.event-card").each((_, el) => {
    const card = $(el);
    const title = strip(card.find(".event-title").first().text());
    if (!title) return;

    const link = card.attr("href") || "";
    const fullLink = link.startsWith("http")
      ? link
      : new URL(link, "https://m.entradium.com").toString();

    const image = card.find("picture img").attr("srcset")?.split("?")[0] || "";

    const dateLabel = strip(card.find(".date span").first().text());
    const date = parseDate(dateLabel);
    if (!date || date < today) return;

    const venue = strip(card.find(".event-venue").first().text());
    // Sólo eventos en Vitoria-Gasteiz
    if (!/vitoria[- ]gasteiz/i.test(venue)) return;

    const price = strip(card.find(".price").text().replace(/^Desde/, ""));

    events.push({
      title,
      date,
      image,
      location: venue,
      link: fullLink,
      price,
    });
  });

  // Si la home móvil no listó eventos, fallback a la home de escritorio (más densa)
  if (events.length === 0) {
    const desktop = await fetch("https://entradium.com/es", {
      headers: { "User-Agent": USER_AGENT_MOBILE },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(25000),
    });
    if (desktop.ok) {
      const $d = cheerio.load(await desktop.text());
      $d("a.event-card").each((_, el) => {
        const card = $d(el);
        const title = strip(card.find(".event-title").first().text());
        if (!title) return;

        const link =
          card.attr("href") && !card.attr("href")!.startsWith("http")
            ? `https://entradium.com${card.attr("href")}`
            : card.attr("href") || "";
        const dateLabel = strip(card.find(".date span").first().text());
        const date = parseDate(dateLabel);
        if (!date || date < today) return;

        const venue = strip(card.find(".event-venue").first().text());
        if (!/vitoria[- ]gasteiz/i.test(venue)) return;

        events.push({
          title,
          date,
          image: card.find("picture img").attr("srcset")?.split("?")[0] || "",
          location: venue,
          link,
          price: strip(card.find(".price").text().replace(/^Desde/, "")),
        });
      });
    }
  }

  return events;
}