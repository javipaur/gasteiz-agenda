import { scrapeJimmyJazz as scrapeJimmyJazzRaw } from "./jimmyjazz";
import { scrapeHelldorado } from "./helldorado";
import { scrapeMusikaze } from "./musikaze";

export interface ConciertoEvent {
  title: string;
  date: string;
  image: string;
  location: string;
  link: string;
  description: string;
  venue: string;
}

export async function scrapeJimmyJazz(): Promise<ConciertoEvent[]> {
  const events = await scrapeJimmyJazzRaw();
  return events.map((e) => ({
    ...e,
    image: e.image || "",
    description: "",
    venue: "Jimmy Jazz Gasteiz",
  }));
}

async function scrapeHellDoradoEvents(): Promise<ConciertoEvent[]> {
  const events = await scrapeHelldorado();
  return events.map((e) => ({
    ...e,
    venue: "HellDorado",
  }));
}

async function scrapeMusikazeEvents(): Promise<ConciertoEvent[]> {
  const events = await scrapeMusikaze();
  return events.map((e) => ({
    ...e,
    venue: e.location.includes("Jimmy Jazz") ? "Jimmy Jazz Gasteiz" : "Musikaze",
  }));
}

export async function scrapeAllConciertos(): Promise<ConciertoEvent[]> {
  const [jimmyJazz, helldorado, musikaze] = await Promise.allSettled([
    scrapeJimmyJazz(),
    scrapeHellDoradoEvents(),
    scrapeMusikazeEvents(),
  ]);

  const all: ConciertoEvent[] = [];

  if (jimmyJazz.status === "fulfilled") all.push(...jimmyJazz.value);
  if (helldorado.status === "fulfilled") all.push(...helldorado.value);
  if (musikaze.status === "fulfilled") all.push(...musikaze.value);

  const seen = new Set<string>();
  return all
    .filter((e) => {
      const key = `${e.title}|${e.date}`.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}
