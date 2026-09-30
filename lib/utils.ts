import * as cheerio from "cheerio";
// AVISO: este import mete los 19 scrapers en el grafo de cliente, porque
// `lib/shared.tsx` es "use client" y llama a `sourceLabel`. Medido en `next
// build`: el chunk compartido de la home pasa de 146 KB a 403 KB, +257 KB de
// parsing con cheerio que el navegador nunca usa. La solución es mover los datos
// del registro (id, label, group, priority, kind, tags, culture, tickets) a un
// módulo hoja sin scrapers y dejar aquí solo los `run`, conservando los mismos
// exports. No se ha hecho en esta tarea porque reordena
// `lib/source-registry.ts`, que ya está cerrado y revisado.
import { SOURCE_LABELS } from "./source-registry";

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

/**
 * Ids que emitían los módulos anteriores al agregador único y que todavía se
 * pintan: `lib/eventos.ts`, `lib/deporte.ts` y `lib/kids.ts` siguen poniendo
 * `vitoria-gasteiz` en `evento.source`, y la home los sigue pintando con
 * `showSource`. Cada valor apunta a su id del registro, de modo que la etiqueta
 * sale de ahí y no hay dos verdades sobre cómo se llama el Ayuntamiento.
 *
 * Es un shim de compatibilidad con fecha de caducidad: cuando esos módulos se
 * retiren, esta tabla se queda vacía y `sourceLabel` vuelve a ser una sola
 * línea.
 */
const LEGACY_SOURCE_IDS: Record<string, string> = {
  "vitoria-gasteiz": "municipal-agenda",
  "vitoria-gasteiz-rss": "municipal-rss",
};

export function sourceLabel(source?: string): string {
  if (!source) return "";
  // El mapeo se resuelve en la llamada y no al cargar el módulo a propósito:
  // `lib/sources/gasteizhoy.ts` importa `fetchOgImage` de este fichero, así que
  // importar el registro desde aquí cierra un ciclo, y leer `SOURCE_LABELS`
  // durante la inicialización daría `undefined` según el orden de carga.
  return (
    SOURCE_LABELS[source] ??
    (LEGACY_SOURCE_IDS[source] ? SOURCE_LABELS[LEGACY_SOURCE_IDS[source]] : undefined) ??
    source
  );
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
