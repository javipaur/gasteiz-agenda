import Link from "next/link";
import {
  Music,
  Clapperboard,
  Sparkles,
  Landmark,
  Trophy,
  Compass,
  Utensils,
  PartyPopper,
} from "lucide-react";
import { getProximosEventos } from "@/lib/eventos";
import { normalizeCategory } from "@/lib/categories";
import { getPeliculas } from "@/lib/cines";
import { getQueVer } from "@/lib/turismo";
import { getSitios } from "@/lib/gastronomia";
import { scrapeFiestasBlanca } from "@/lib/sources/fiestas-blanca";
import { isBlancaSeason } from "@/lib/blanca";

const CULTURA_SET = new Set(["Teatro", "Exposiciones", "Danza", "Conferencias", "Talleres", "Visitas"]);
const DEPORTE_SET = new Set(["Deporte", "Senderismo"]);
const CONCIERTOS_SET = new Set(["Conciertos", "Música"]);
const INFANTIL_SET = new Set(["Infantil", "Kids"]);

async function countEventsInWindow(cats: Set<string>): Promise<number> {
  try {
    const eventos = await getProximosEventos();
    const limit = new Date();
    limit.setDate(limit.getDate() + 7);
    let count = 0;
    for (const ev of eventos) {
      const d = new Date(ev.date);
      if (isNaN(d.getTime()) || d > limit) continue;
      if (cats.has(normalizeCategory(ev.category))) count++;
    }
    return count;
  } catch {
    return 0;
  }
}

async function getCounts() {
  const [conciertos, cine, ninos, cultura, deporte, curated, fiestas] =
    await Promise.allSettled([
      countEventsInWindow(CONCIERTOS_SET),
      (async () => (await getPeliculas()).length)(),
      countEventsInWindow(INFANTIL_SET),
      countEventsInWindow(CULTURA_SET),
      countEventsInWindow(DEPORTE_SET),
      Promise.all([getQueVer(), getSitios()]),
      scrapeFiestasBlanca(),
    ]);

  return {
    conciertos: conciertos.status === "fulfilled" ? conciertos.value : 0,
    cine: cine.status === "fulfilled" ? cine.value : 0,
    ninos: ninos.status === "fulfilled" ? ninos.value : 0,
    cultura: cultura.status === "fulfilled" ? cultura.value : 0,
    deporte: deporte.status === "fulfilled" ? deporte.value : 0,
    turismo: ofFulfilled(curated, (v) => v[0].length),
    gastronomia: ofFulfilled(curated, (v) => v[1].length),
    fiestas: fiestas.status === "fulfilled" ? fiestas.value.length : 0,
  };
}

function ofFulfilled<T, R>(r: PromiseSettledResult<T>, fn: (v: T) => R): number {
  return r.status === "fulfilled" ? (fn(r.value) as number) : 0;
}

export default async function SectionsHub() {
  const counts = await getCounts();
  const fiestasEnabled = isBlancaSeason();

  const categories = [
    {
      label: "Conciertos",
      href: "/conciertos",
      desc: "Música en vivo",
      tint: "bg-teal/10 border-teal/20",
      wash: "radial-gradient(420px 160px at 90% -20%, var(--teal-wash), transparent 60%)",
      icon: Music,
      count: counts.conciertos,
      unit: " esta semana",
    },
    {
      label: "Cine",
      href: "/movies",
      desc: "Cartelera en Vitoria",
      tint: "bg-blue/10 border-blue/20",
      wash: "radial-gradient(420px 160px at 90% -20%, rgba(74,124,156,0.08), transparent 60%)",
      icon: Clapperboard,
      count: counts.cine,
      unit: " películas",
    },
    {
      label: "Niños",
      href: "/kids",
      desc: "Planes familiares",
      tint: "bg-amber/10 border-amber/20",
      wash: "radial-gradient(420px 160px at 90% -20%, var(--amber-wash), transparent 60%)",
      icon: Sparkles,
      count: counts.ninos,
      unit: " esta semana",
    },
    {
      label: "Cultura",
      href: "/culture",
      desc: "Teatro, exposiciones",
      tint: "bg-accent/10 border-accent/20",
      wash: "radial-gradient(420px 160px at 90% -20%, var(--accent-wash), transparent 60%)",
      icon: Landmark,
      count: counts.cultura,
      unit: " esta semana",
    },
    {
      label: "Deporte",
      href: "/deporte",
      desc: "Running, trail, eventos",
      tint: "bg-green/10 border-green/20",
      wash: "radial-gradient(420px 160px at 90% -20%, rgba(43,107,74,0.08), transparent 60%)",
      icon: Trophy,
      count: counts.deporte,
      unit: " esta semana",
    },
    {
      label: "Turismo",
      href: "/turismo",
      desc: "Qué ver en Gasteiz",
      tint: "bg-teal/10 border-teal/20",
      wash: "radial-gradient(420px 160px at 90% -20%, var(--teal-wash), transparent 60%)",
      icon: Compass,
      count: counts.turismo,
      unit: " sitios",
    },
    {
      label: "Gastronomía",
      href: "/gastronomia",
      desc: "Pintxos y sitios",
      tint: "bg-amber/10 border-amber/20",
      wash: "radial-gradient(420px 160px at 90% -20%, var(--amber-wash), transparent 60%)",
      icon: Utensils,
      count: counts.gastronomia,
      unit: " sitios",
    },
    {
      label: "La Blanca",
      href: "/fiestas-blanca",
      desc: fiestasEnabled
        ? "Programa de fiestas"
        : "Fiestas en agosto",
      tint: "bg-accent/10 border-accent/20",
      wash: "radial-gradient(420px 160px at 90% -20%, var(--accent-wash), transparent 60%)",
      icon: PartyPopper,
      count: counts.fiestas,
      unit: " actos",
    },
  ];

  return (
    <section className="px-5 sm:px-6 py-8 md:py-12 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <h2 className="font-display text-xl md:text-2xl text-fg font-bold tracking-[-0.02em]">
          Explora Vitoria-Gasteiz
        </h2>
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {categories.map(({ label, href, desc, tint, wash, icon: Icon, count, unit }) => {
          const showCount = count > 0 && !(label === "La Blanca" && !fiestasEnabled);
          return (
            <Link
              key={href}
              href={href}
              className={`group relative overflow-hidden rounded-2xl border ${tint} p-5 min-h-[132px] flex flex-col justify-between card-hover hover:shadow-lg hover:shadow-accent/10 active:scale-[0.98]`}
            >
              <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: wash }} />
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative flex items-start justify-between gap-2">
                <span className="grid size-11 place-items-center rounded-xl bg-surface border border-border shadow-sm text-fg transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:border-accent/30 group-hover:text-accent group-hover:-translate-y-0.5">
                  <Icon size={18} strokeWidth={1.75} />
                </span>
                <span
                  aria-hidden="true"
                  className="shrink-0 text-fg-subtle transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:text-accent group-hover:translate-x-0.5"
                >
                  →
                </span>
              </div>
              <div className="relative">
                <h3 className="font-display text-lg font-bold text-fg leading-tight tracking-[-0.01em] group-hover:text-accent transition-colors duration-300">
                  {label}
                </h3>
                <p className="text-xs text-fg-muted mt-0.5 tabular-nums">
                  {showCount ? (
                    <>
                      <span className="font-semibold text-fg">{count}</span>
                      {unit}
                    </>
                  ) : (
                    desc
                  )}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}