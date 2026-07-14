import * as cheerio from "cheerio";

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
  switch (source) {
    case "rula": return "La Genterula";
    case "gasteizhoy": return "Gasteiz Hoy";
    case "fever": return "Fever";
    case "vam": return "VAM";
    case "euskadi": return "Euskadi";
    case "vitoria-gasteiz": return "Ayuntamiento";
    default: return source || "";
  }
}
