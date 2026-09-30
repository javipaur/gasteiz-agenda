import * as cheerio from "cheerio";
// Importa de `source-data` y no de `source-registry` a propósito: este fichero
// lo carga `lib/shared.tsx`, que es "use client", así que llegar al registro
// compuesto arrastraría los 18 scrapers al navegador (+257 KB de chunk, medido).
// El token de la API MEC de La Genterula venía dentro. La regla la comprueba
// `__tests__/source-data.test.ts`.
import { SOURCE_LABELS } from "./source-data";

const ogImageCache = new Map<string, string | undefined>();

export async function fetchOgImage(url: string): Promise<string | undefined> {
  const cached = ogImageCache.get(url);
  if (cached !== undefined) return cached;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      ogImageCache.set(url, undefined);
      return undefined;
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const ogImage =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content");

    if (ogImage) {
      const absolute = ogImage.startsWith("http")
        ? ogImage
        : new URL(ogImage, url).href;
      ogImageCache.set(url, absolute);
      return absolute;
    }

    const firstImg = $(
      "article img, .entry-content img, main img, .content img"
    )
      .first()
      .attr("src");
    if (firstImg) {
      const absolute = firstImg.startsWith("http")
        ? firstImg
        : new URL(firstImg, url).href;
      ogImageCache.set(url, absolute);
      return absolute;
    }

    ogImageCache.set(url, undefined);
    return undefined;
  } catch {
    ogImageCache.set(url, undefined);
    return undefined;
  }
}

export const MONTHS = [
  "ENE", "FEB", "MAR", "ABR", "MAY", "JUN",
  "JUL", "AGO", "SEP", "OCT", "NOV", "DIC",
];

export function formatDate(dateStr: string): { day: string; month: string } {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { day: "??", month: "???" };
  return {
    day: String(d.getDate()).padStart(2, "0"),
    month: MONTHS[d.getMonth()],
  };
}

export function formatSpanishDate(dateStr: string) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { day: "??", month: "???", year: "" };
  return {
    day: String(d.getDate()).padStart(2, "0"),
    month: MONTHS[d.getMonth()],
    year: String(d.getFullYear()),
  };
}

export function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function sourceLabel(source?: string): string {
  if (!source) return "";
  // El mapa se resuelve en la llamada y no al cargar el módulo. Este fichero lo
  // carga `lib/shared.tsx`, que es un componente cliente, así que la frontera que
  // de verdad importa es la del import de arriba: solo la hoja de datos, nunca el
  // registro compuesto, o los 18 scrapers acabarían en el navegador. Resolverlo
  // aquí dentro deja además esta función sin nada construido en el ámbito del
  // módulo.
  return SOURCE_LABELS[source] ?? source;
}

export function dayBadgeLabel(dateStr: string): string | null {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const target = localDateStr(d);
  if (target === localDateStr(today)) return "HOY";
  if (target === localDateStr(tomorrow)) return "MAÑ";
  return null;
}

export function shortTime(time?: string): string | null {
  if (!time) return null;
  const t = time.trim();
  const m = t.match(/^(\d{1,2})[:.h](\d{2})/i);
  if (m) return `${m[1]}:${m[2]}`;
  if (/^\d{1,2}$/.test(t)) return `${t}:00`;
  return null;
}
