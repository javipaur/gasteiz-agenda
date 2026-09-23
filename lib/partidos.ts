import fs from "fs/promises";
import path from "path";
import { getCachedOrFetch } from "./cache";
import { scrapePartidosCMS, type Partido } from "./sources/clubCms";

const ARASKI_PATH = path.join(process.cwd(), "data", "partidos", "araski.json");

type AraskiPayload = {
  equipo?: string;
  partidos?: Array<{
    fecha?: string;
    competicion?: string;
    local?: { nombre?: string; escudo?: string | null };
    visitante?: { nombre?: string; escudo?: string | null };
    estadio?: string;
    link?: string;
  }>;
};

export async function getPartidosAraski(): Promise<Partido[]> {
  try {
    const raw = await fs.readFile(ARASKI_PATH, "utf-8");
    const payload = JSON.parse(raw) as AraskiPayload;
    const equipo = payload.equipo || "Kutxabank Araski";
    return (payload.partidos ?? []).map((p, i) => ({
      id: `araski-${i}-${p.fecha ?? "sin-fecha"}`,
      equipo: "araski" as const,
      club: equipo,
      competicion: p.competicion || "Liga Femenina Endesa",
      fecha: typeof p.fecha === "string" && !isNaN(new Date(p.fecha).getTime()) ? p.fecha : null,
      hora: typeof p.fecha === "string" ? p.fecha.split("T")[1]?.slice(0, 8) ?? null : null,
      local: { nombre: p.local?.nombre || "Kutxabank Araski", url: p.local?.escudo ?? undefined },
      visitante: { nombre: p.visitante?.nombre || "Rival", url: p.visitante?.escudo ?? undefined },
      estadio: p.estadio || null,
      marcador: null,
      link: p.link || null,
      fuente: "manual" as const,
    }));
  } catch {
    return [];
  }
}

export function getTodosLosPartidos(): Promise<Partido[]> {
  return getCachedOrFetch("partidos-proximos", 5 * 60 * 1000, async () => {
    const [cms, araski] = await Promise.allSettled([scrapePartidosCMS(), getPartidosAraski()]);
    const out: Partido[] = [];
    if (cms.status === "fulfilled") out.push(...cms.value);
    if (araski.status === "fulfilled") out.push(...araski.value);
    return out.sort(
      (a, b) => (a.fecha ? new Date(a.fecha).getTime() : Infinity) - (b.fecha ? new Date(b.fecha).getTime() : Infinity)
    );
  });
}

function esProximo(partido: Partido, now = new Date()): boolean {
  if (!partido.fecha) return false;
  const game = new Date(partido.fecha);
  if (isNaN(game.getTime())) return false;
  const hoy = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diaPartido = new Date(game.getFullYear(), game.getMonth(), game.getDate());
  return diaPartido >= hoy;
}

export async function getProximosPartidos(nPorEquipo = 1): Promise<Partido[]> {
  const todos = await getTodosLosPartidos();
  const proximos = todos.filter((p) => esProximo(p));
  const porEquipo: Partial<Record<string, Partido[]>> = {};
  for (const p of proximos) {
    const lista = (porEquipo[p.equipo] ||= []);
    if (lista.length < nPorEquipo) lista.push(p);
  }
  return Object.values(porEquipo)
    .flatMap((partidos) => partidos ?? [])
    .sort((a, b) => (a.fecha ? new Date(a.fecha).getTime() : Infinity) - (b.fecha ? new Date(b.fecha).getTime() : Infinity));
}
