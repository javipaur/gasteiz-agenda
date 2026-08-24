import { scrapeMunicipalCalendar } from "./sources/municipal";
import { scrapeJimmyJazz } from "./sources/jimmyjazz";
import { scrapeVamConciertos } from "./sources/vam";
import { scrapeFever } from "./sources/fever";
import { scrapeRula } from "./sources/rula";
import { scrapeGasteizHoy } from "./sources/gasteizhoy";
import { getCachedOrFetch } from "./cache";
import { mapToCultureCategory } from "./categories";

export type CulturaEvento = {
  id: string;
  title: string;
  date: string;
  image: string;
  location: string;
  link: string;
  category: string;
  source: string;
};

function normalizeEvento(
  e: Record<string, unknown>,
  category: string,
  source: string
): CulturaEvento {
  const raw = e as {
    id?: string;
    title?: string;
    date?: string;
    image?: string;
    location?: string;
    link?: string;
    category?: string;
    source?: string;
  };

  return {
    id: raw.id || crypto.randomUUID(),
    title: raw.title || "Sin título",
    date: raw.date || "",
    image: raw.image?.startsWith("http") ? raw.image : "",
    location: raw.location || "",
    link: raw.link || "",
    category: mapToCultureCategory(raw.category || category),
    source: raw.source || source,
  };
}

async function fetchCultura(): Promise<CulturaEvento[]> {
  const [municipalEventos, municipalTeatro, jimmyJazz, municipalConcierto, vamConciertos, municipalExposiciones, fever, rula, gasteizhoy] = await Promise.allSettled([
    scrapeMunicipalCalendar({ tipo: [6] }),
    scrapeMunicipalCalendar({ tipo: [13] }),
    scrapeJimmyJazz(),
    scrapeMunicipalCalendar({ tipo: [2] }),
    scrapeVamConciertos(),
    scrapeMunicipalCalendar({ tipo: [7] }),
    scrapeFever(),
    scrapeRula(),
    scrapeGasteizHoy(),
  ]);

  const eventos: CulturaEvento[] = [];

  const push = (
    result: PromiseSettledResult<readonly unknown[]>,
    category: string,
    source: string
  ) => {
    if (result.status === "fulfilled") {
      eventos.push(
        ...result.value.map((e) =>
          normalizeEvento(e as Record<string, unknown>, category, source)
        )
      );
    }
  };

  push(municipalEventos, "agenda", "municipal");
  push(municipalTeatro, "teatro", "municipal");
  push(jimmyJazz, "conciertos", "jimmyjazz");
  push(municipalConcierto, "conciertos", "municipal");
  push(vamConciertos, "conciertos", "vam");
  push(municipalExposiciones, "exposiciones", "municipal");

  if (fever.status === "fulfilled") {
    eventos.push(...fever.value.map((e) => normalizeEvento({ ...e }, e.category || "agenda", "fever")));
  }
  if (rula.status === "fulfilled") {
    eventos.push(...rula.value.map((e) => normalizeEvento({ ...e }, e.category || "agenda", "rula")));
  }
  if (gasteizhoy.status === "fulfilled") {
    eventos.push(...gasteizhoy.value.map((e) => normalizeEvento({ ...e }, e.category || "agenda", "gasteizhoy")));
  }

  return eventos.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

export function getCultureEventos(): Promise<CulturaEvento[]> {
  return getCachedOrFetch("cultura-eventos", 5 * 60 * 1000, fetchCultura);
}
