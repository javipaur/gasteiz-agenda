import { NextResponse } from "next/server";

const VAM_API = "https://app.vamcultura.es/functions/getPublicEvents";

export async function GET() {
  try {
    const res = await fetch(VAM_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Error al cargar VAM" }, { status: res.status });
    }

    const data = await res.json();
    const events = data.events ?? data.data ?? [];

    const vitoriaConcerts = events
      .filter(
        (e: any) =>
          e.city === "Vitoria-Gasteiz" &&
          e.category?.includes("Concierto")
      )
      .map((e: any) => {
        const img = e.image_url || "";
        const image = img.startsWith("http") ? img : (img ? `https://www.kulturklik.euskadi.eus${img}` : null);

        const dateStr = e.date_start || e.date_end;
        const date = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString();

        return {
          title: e.title || "Sin título",
          date,
          image,
          location: e.place || e.city || "Vitoria-Gasteiz",
          link: e.source_url || "#",
        };
      });

    // Ordenar por fecha
    vitoriaConcerts.sort(
      (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return NextResponse.json(vitoriaConcerts);
  } catch (error) {
    console.error("Error scraping VAM:", error);
    return NextResponse.json({ error: "No se pudieron obtener eventos de VAM" }, { status: 500 });
  }
}
