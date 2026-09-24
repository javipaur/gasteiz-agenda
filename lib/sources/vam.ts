import * as cheerio from "cheerio";

const VAM_API = "https://app.vamcultura.es/functions/getPublicEvents";

const imageCache = new Map<string, string | undefined>();

const DEFAULT_EVENT_IMAGE =
  "https://opendata.euskadi.eus//contenidos/evento/2026070810071363/es_def/images/22.jpg";

function esVitoria(city: unknown): boolean {
  return /^vitoria/i.test(String(city || "").trim());
}

function inferCategory(vamCategory: string): string {
  const cat = vamCategory.toLowerCase();
  if (cat.includes("concierto") || cat.includes("música")) return "Música";
  if (cat.includes("teatro")) return "Teatro";
  if (cat.includes("danza")) return "Danza";
  if (cat.includes("cine")) return "Cine";
  if (cat.includes("exposic")) return "Exposiciones";
  if (cat.includes("festival")) return "Festival";
  if (cat.includes("infantil") || cat.includes("familiar")) return "Infantil";
  if (cat.includes("conferencia") || cat.includes("charla")) return "Conferencias";
  if (cat.includes("deporte") || cat.includes("senderismo")) return "Deporte";
  return "Otros";
}

function resolveImageUrl(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  if (raw.startsWith("http")) return raw;
  return `https://www.kulturklik.euskadi.eus${raw}`;
}

async function fetchOgImage(url: string): Promise<string | undefined> {
  const cached = imageCache.get(url);
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
      imageCache.set(url, undefined);
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
      imageCache.set(url, absolute);
      return absolute;
    }

    const firstImg = $("article img, .content img, main img, .entry-content img")
      .first()
      .attr("src");
    if (firstImg) {
      const absolute = firstImg.startsWith("http")
        ? firstImg
        : new URL(firstImg, url).href;
      imageCache.set(url, absolute);
      return absolute;
    }

    imageCache.set(url, undefined);
    return undefined;
  } catch {
    imageCache.set(url, undefined);
    return undefined;
  }
}

async function enrichWithImages<T extends { image?: string; link: string; title?: string }>(
  events: T[],
  concurrency = 5
): Promise<T[]> {
  const needsOgImage = events.filter((e) => !e.image && e.link && e.link !== "#");
  const chunks: T[][] = [];
  for (let i = 0; i < needsOgImage.length; i += concurrency) {
    chunks.push(needsOgImage.slice(i, i + concurrency));
  }

  for (const chunk of chunks) {
    const results = await Promise.allSettled(
      chunk.map(async (e) => {
        const ogImage = await fetchOgImage(e.link);
        if (ogImage) e.image = ogImage;
      })
    );
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.warn(`Failed to fetch og:image for ${chunk[i].link}`);
      }
    });
  }

  for (const e of events) {
    if (!e.image) {
      e.image = DEFAULT_EVENT_IMAGE;
    }
  }

  return events;
}

export type VamEvent = {
  title: string;
  date: string;
  image?: string;
  location: string;
  link: string;
  category: string;
  source: string;
  description: string;
  time: string;
};

async function fetchAllVamEvents(): Promise<any[]> {
  const res = await fetch(VAM_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    body: "{}",
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.events ?? data.data ?? [];
}

export async function scrapeVamEvents(): Promise<VamEvent[]> {
  const allEvents = await fetchAllVamEvents();

  const events = allEvents
    .filter((e: any) => esVitoria(e.city))
    .map((e: any) => {
      const image = resolveImageUrl(e.image_url);
      const dateStr = e.date_start || e.date_end;
      const date = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString();

      return {
        title: e.title || "Sin título",
        date,
        image,
        location: e.place || e.city || "Vitoria-Gasteiz",
        link: e.source_url || "#",
        category: inferCategory(e.category || ""),
        source: "vam",
        description: e.description || "",
        time: e.schedule_raw || "",
      };
    })
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

  await enrichWithImages(events);
  return events;
}

export async function scrapeVamConciertos(): Promise<any[]> {
  const allEvents = await fetchAllVamEvents();

  const events = allEvents
    .filter(
      (e: any) =>
        esVitoria(e.city) &&
        e.category?.includes("Concierto")
    )
    .map((e: any) => {
      const image = resolveImageUrl(e.image_url);
      const dateStr = e.date_start || e.date_end;
      const date = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString();

      return {
        title: e.title || "Sin título",
        date,
        image,
        location: e.place || e.city || "Vitoria-Gasteiz",
        link: e.source_url || "#",
      };
    })
    .sort(
      (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

  await enrichWithImages(events);
  return events;
}
