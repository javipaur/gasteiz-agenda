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
const AJAX_URL = "https://arkabia.eus/wp-admin/admin-ajax.php";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function parseFecha(fecha: string): string {
  // Formats seen: "04/06 - 13/10/2026", "12/09/2026", "01/01"
  const m = fecha.match(/(\d{2})\/(\d{2})(?:\/(\d{4}))?/);
  if (!m) return "";
  const year = m[3] || String(new Date().getFullYear());
  return `${year}-${m[2]}-${m[1]}`;
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
  const $home = cheerio.load(homeHtml);
  const nonce =
    $home(".modulo-programacion__filtros").attr("data-eventos-nonce") || "";

  if (!nonce) {
    console.error("Arkabia: no se encontró el nonce de filtrado");
    return [];
  }

  const body = new URLSearchParams();
  body.append("action", "filtrar_eventos");
  body.append("nonce", nonce);
  body.append("filtro", "todos");

  const ajax = await fetch(AJAX_URL, {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT,
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    body,
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(20000),
  });

  if (!ajax.ok) {
    console.error(`Arkabia AJAX returned ${ajax.status}`);
    return [];
  }

  const json = (await ajax.json().catch(() => null)) as {
    success?: boolean;
    data?: { html?: string; message?: string };
  } | null;
  if (!json?.success) {
    console.error("Arkabia AJAX: response not successful");
    return [];
  }

  return parseItems(json?.data?.html || "");
}