const EUSKADI_URL = "https://api.euskadi.eus/culture/events/v1.0/events/upcoming?_elements=20&_page=1&municipalityNoraCode=46&provinceNoraCode=1";

export type EuskadiEvent = {
  id: string;
  title: string;
  date: string;
  image?: string;
  location: string;
  link: string;
  category: string;
  source: string;
};

export async function scrapeEuskadi(): Promise<EuskadiEvent[]> {
  try {
    const res = await fetch(EUSKADI_URL, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    const items: any[] = data?.items || [];
    return items.map((e: any) => ({
      id: e.id || crypto.randomUUID(),
      title: e.nameEs?.trim() || "Sin título",
      date: e.startDate?.trim() || null,
      image: e?.images?.length ? e.images[0].imageUrl : undefined,
      location: e.establishmentEs || "Desconocido",
      link: e.sourceUrlEs?.startsWith("http") ? e.sourceUrlEs : "",
      category: e.typeEs?.toLowerCase()?.trim() || "evento",
      source: "euskadi",
    }));
  } catch {
    return [];
  }
}
