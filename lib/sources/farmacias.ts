const BASE_URL = "https://cofalava.org/farmacias-de-guardia/";

export type FarmaciaGuardia = {
  id: string;
  name: string;
  address: string;
  shortAddress: string;
  phone: string;
  date: string;
  horarios: string;
  neighborhood: string;
  city: string;
  zone: string;
  lat: string;
  lng: string;
};

let cache: FarmaciaGuardia[] | null = null;
let lastFetch = 0;
const CACHE_TTL = 1000 * 60 * 60 * 6;

function parseFechaISO(fecha: string): string {
  const parts = fecha.split("/").map(Number);
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return "";
}

function extractPlacesFromHtml(html: string): any[] {
  const marker = '"places":[';
  const idx = html.indexOf(marker);
  if (idx < 0) return [];

  const start = idx + marker.length - 1;
  let depth = 0;
  let end = start;
  for (let i = start; i < html.length; i++) {
    if (html[i] === "[") depth++;
    else if (html[i] === "]") depth--;
    if (depth === 0) {
      end = i + 1;
      break;
    }
  }

  try {
    return JSON.parse(html.slice(start, end));
  } catch {
    return [];
  }
}

export async function scrapeFarmacias(): Promise<FarmaciaGuardia[]> {
  const now = Date.now();
  if (cache && now - lastFetch < CACHE_TTL) {
    return cache;
  }

  try {
    const res = await fetch(BASE_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(15000),
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      if (cache) return cache;
      return [];
    }

    const html = await res.text();
    const places = extractPlacesFromHtml(html);

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const farmacias: FarmaciaGuardia[] = places
      .filter((p: any) => {
        const ef = p.location?.extra_fields;
        if (!ef) return false;
        const fecha = parseFechaISO(ef.fecha || "");
        return fecha === todayStr;
      })
      .filter((p: any) => {
        const zona = p.location?.extra_fields?.zona_css || "";
        const poblacion = p.location?.extra_fields?.poblacion || "";
        return zona === "vitoria-gasteiz" || poblacion === "Vitoria-Gasteiz";
      })
      .map((p: any) => {
        const ef = p.location?.extra_fields || {};
        return {
          id: p.id || "",
          name: p.title || "",
          address: p.address || "",
          shortAddress: ef["direccion-corta"] || "",
          phone: ef.telefono || "",
          date: parseFechaISO(ef.fecha || ""),
          horarios: ef.horarios || "",
          neighborhood: ef.barrio || "",
          city: ef.poblacion || "",
          zone: ef.zona || "",
          lat: p.location?.lat || "",
          lng: p.location?.lng || "",
        };
      })
      .sort((a: FarmaciaGuardia, b: FarmaciaGuardia) =>
        a.name.localeCompare(b.name)
      );

    cache = farmacias;
    lastFetch = now;

    return farmacias;
  } catch (error) {
    console.error("Error scraping farmacias de guardia:", error);
    if (cache) return cache;
    return [];
  }
}
