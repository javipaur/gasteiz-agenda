import Link from "next/link";
import Image from "next/image";
import {
  Music,
  Clapperboard,
  Sparkles,
  Landmark,
  Trophy,
  Compass,
  Utensils,
  PartyPopper,
  type LucideIcon,
} from "lucide-react";
import { getProximosEventos } from "@/lib/eventos";
import { CATEGORY_COLORS, normalizeCategory } from "@/lib/categories";
import SectionHead from "./SectionHead";
import { getPeliculas } from "@/lib/cines";
import { getQueVer } from "@/lib/turismo";
import { getSitios, getRutasPintxos } from "@/lib/gastronomia";
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
      Promise.all([getQueVer(), getSitios(), getRutasPintxos()]),
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
    gastronomiaRutas: ofFulfilled(curated, (v) => v[2].length),
    gastronomiaImagen:
      curated.status === "fulfilled"
        ? curated.value[1].find((s) => s.imagen)?.imagen
        : undefined,
    fiestas: fiestas.status === "fulfilled" ? fiestas.value.length : 0,
  };
}

function ofFulfilled<T, R>(r: PromiseSettledResult<T>, fn: (v: T) => R): number {
  return r.status === "fulfilled" ? (fn(r.value) as number) : 0;
}

type CategoryCard = {
  label: string;
  href: string;
  desc: string;
  tint: string;
  wash: string;
  icon: LucideIcon;
  count: number;
  unit: string;
  imagen?: string;
  meta?: string;
};

export default async function SectionsHub() {
  const counts = await getCounts();
  const fiestasEnabled = isBlancaSeason();

  const categories: CategoryCard[] = [
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
      imagen: counts.gastronomiaImagen,
      meta:
        counts.gastronomiaRutas > 0
          ? `${counts.gastronomia} sitios · ${counts.gastronomiaRutas} rutas`
          : undefined,
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
      <SectionHead tag="Categorías" title="Explora Vitoria-Gasteiz" color="var(--teal)" />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {categories.map(({ label, href, desc, tint, wash, icon: Icon, count, unit, imagen, meta }) => {
          const showCount = count > 0 && !(label === "La Blanca" && !fiestasEnabled);
          return (
            <Link
              key={href}
              href={href}
              className={`group relative overflow-hidden rounded-2xl border ${tint} p-5 min-h-[132px] flex flex-col justify-between card-hover hover:shadow-lg hover:shadow-accent/10 active:scale-[0.98]`}
            >
              {imagen ? (
                <>
                  <Image
                    src={imagen}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 50vw, 25vw"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-[800ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105"
                  />
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/5" />
                  <div className="relative flex items-start justify-between gap-2">
                    <span className="grid size-11 place-items-center rounded-xl bg-white/15 backdrop-blur-md border border-white/25 text-white shadow-lg shadow-black/10 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:border-white/40 group-hover:-translate-y-0.5">
                      <Icon size={18} strokeWidth={1.75} />
                    </span>
                    <span
                      aria-hidden="true"
                      className="shrink-0 text-white/80 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:text-white group-hover:translate-x-0.5"
                    >
                      →
                    </span>
                  </div>
                  <div className="relative">
                    <h3 className="font-display text-lg font-semibold text-white leading-tight tracking-[-0.01em]">
                      {label}
                    </h3>
                    <p className="text-xs text-white/75 mt-0.5 tabular-nums">
                      {meta ||
                        (showCount ? (
                          <>
                            <span className="font-semibold text-white">{count}</span>
                            {unit}
                          </>
                        ) : (
                          desc
                        ))}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: wash }} />
                  <div className="relative flex items-start justify-between gap-2">
                    <span
                      className="grid size-11 place-items-center rounded-xl text-[#0B0E14] shadow-lg transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-y-0.5"
                      style={{ backgroundColor: CATEGORY_COLORS[label] || "var(--accent)", color: "#0B0E14" }}
                    >
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
                    <h3 className="font-display text-lg font-semibold text-fg leading-tight tracking-[-0.01em] group-hover:text-accent transition-colors duration-300">
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
                </>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}