import * as cheerio from "cheerio";

export type ArkabiaEvento = {
  title: string;
  subtitle?: string;
  image: string;
  link: string;
  fecha: string;
  precio: string;
  categoria: string[];
  date: string;
};

const HOME_URL = "https://arkabia.eus/";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function parseFecha(fecha: string): string {
  // Formatos medidos en la home en vivo:
  //   "04/06 - 12/10/2026"        rango, dia/mes a la izquierda
  //   "26/09/2026 - 21/01/2027"   rango, fecha completa a la izquierda
  //   "07/10/2026"                fecha simple
  //   "03-04/10/2026"             rango pegado al dia
  //
  // El regex de antes era `(\d{2})\/(\d{2})(?:\/(\d{4}))?`, que engancha en el
  // **primer** par dia/mes que encuentra. En "04/06 - 12/10/2026" eso es el
  // 04/06, sin ano, asi que tomaba el ano en curso y daba `2026-10-06`: dos
  // cosas mal, el dia del mes y el ano. Y en "03-04/10/2026" enganchaba en el
  // 04/10, o sea la fecha **de fin** en vez de la de inicio.
  //
  // Se separa primero el tramo de la izquierda del rango y se interpreta entero,
  // que es lo que significa.
  const izquierda = fecha.split(/\s+-\s+/)[0].trim();

  const conRangoPegado = izquierda.match(/(\d{2})-(\d{2})\/(\d{2})\/(\d{4})/);
  if (conRangoPegado) {
    return `${conRangoPegado[4]}-${conRangoPegado[3]}-${conRangoPegado[1]}`;
  }

  const conAno = izquierda.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (conAno) return `${conAno[3]}-${conAno[2]}-${conAno[1]}`;

  const sinAno = izquierda.match(/(\d{2})\/(\d{2})$/);
  if (sinAno) {
    return `${String(new Date().getFullYear())}-${sinAno[2]}-${sinAno[1]}`;
  }

  return "";
}

function parseItems(html: string): ArkabiaEvento[] {
  if (!html) return [];
  const $ = cheerio.load(html);
  const eventos: ArkabiaEvento[] = [];

  $(".modulo-programacion__item").each((_, el) => {
    const card = $(el);

    const imageEl = card.find(".modulo-programacion__imagen img");
    const image =
      imageEl.attr("src") || imageEl.attr("data-src") || "";

    const link =
      card.find(".modulo-programacion__imagen").attr("href") || "";

    const titulares = card.find(".modulo-programacion__titular");
    const title = $(titulares.get(0)).text().trim();
    const subtitle = $(titulares.get(1)).text().trim();
    if (!title) return;

    const fecha = card.find("span.fecha").text().trim();
    const precio = card.find("span.precio").text().trim();

    const categoria: string[] = [];
    card.find(".etiquetas a.etiqueta").each((_, a) => {
      const label = $(a).text().trim();
      if (label) categoria.push(label);
    });

    eventos.push({
      title,
      subtitle: subtitle || undefined,
      image,
      link,
      fecha,
      precio,
      categoria,
      date: parseFecha(fecha),
    });
  });

  return eventos;
}

export async function scrapeArkabia(): Promise<ArkabiaEvento[]> {
  const home = await fetch(HOME_URL, {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(20000),
  });

  if (!home.ok) {
    console.error(`Arkabia homepage returned ${home.status}`);
    return [];
  }

  const homeHtml = await home.text();

  // **La home es la fuente, no el AJAX.** El `admin-ajax.php?filtrar_eventos`
  // que usa el boton del propio sitio responde `success: true` con un
  // `<div class="no-results">` y cero tarjetas, para los tres filtros
  // (semana, mes, todos). No es un problema nuestro: `/evento/` y
  // `/evento-cat/*/` tambien salen vacios, asi que el `WP_Query` del CPT esta
  // roto en el sitio y los botones de la web vacian la lista al pulsarlos.
  //
  // La home, en cambio, renderiza los eventos en servidor y trae 16 con el
  // markup completo. Es la unica fuente viable: el CPT no esta en el REST de
  // WordPress (`/wp-json/wp/v2/types` no lo lista) y el RSS trae la fecha de
  // publicacion del post, no la del evento.
  const desdeLaHome = parseItems(homeHtml);
  if (desdeLaHome.length > 0) {
    return desdeLaHome;
  }

  // La home tampoco traia nada. Se registra por que, porque ahora mismo es un
  // fallo de scrape y no se distingue de un centro sin programacion.
  console.error(
    "Arkabia: la home no trajo tarjetas de " +
      ".modulo-programacion__item. Si el site sigue asi, no hay agenda que leer."
  );
  return [];
}