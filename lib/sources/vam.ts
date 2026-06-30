const VAM_API = "https://app.vamcultura.es/functions/getPublicEvents";

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
    headers: { "Content-Type": "application/json" },
    body: "{}",
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.events ?? data.data ?? [];
}

export async function scrapeVamEvents(): Promise<VamEvent[]> {
  const allEvents = await fetchAllVamEvents();

  return allEvents
    .filter((e: any) => e.city === "Vitoria-Gasteiz")
    .map((e: any) => {
      const img = e.image_url || "";
      const image = img.startsWith("http") ? img : (img ? `https://www.kulturklik.euskadi.eus${img}` : undefined);
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
}

export async function scrapeVamConciertos(): Promise<any[]> {
  const allEvents = await fetchAllVamEvents();

  return allEvents
    .filter(
      (e: any) =>
        e.city === "Vitoria-Gasteiz" &&
        e.category?.includes("Concierto")
    )
    .map((e: any) => {
      const img = e.image_url || "";
      const image = img.startsWith("http") ? img : (img ? `https://www.kulturklik.euskadi.eus${img}` : undefined);
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
}
