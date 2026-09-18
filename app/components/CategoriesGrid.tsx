import Link from "next/link";
import { Music, Landmark, Trophy, Clapperboard } from "lucide-react";
import { getProximosEventos } from "@/lib/eventos";
import { normalizeCategory } from "@/lib/categories";
import { getCachedOrFetch } from "@/lib/cache";
import { scrapeFlorida } from "@/lib/sources/cines";
import { scrapeBoulevard } from "@/app/services/boulevard";

const CULTURA_SET = new Set(["Teatro", "Exposiciones", "Danza", "Conferencias", "Talleres", "Visitas"]);
const DEPORTE_SET = new Set(["Deporte", "Senderismo"]);

async function getCarteleraCount(): Promise<number> {
  try {
    const peliculas = await getCachedOrFetch(
      "api-cines",
      5 * 60 * 1000,
      async () => {
        const [florida, boulevard] = await Promise.allSettled([
          scrapeFlorida(),
          scrapeBoulevard(),
        ]);
        return [
          ...(florida.status === "fulfilled" ? florida.value : []),
          ...(boulevard.status === "fulfilled" ? boulevard.value : []),
        ];
      }
    );
    return peliculas.length;
  } catch {
    return 0;
  }
}

async function getCategoryCounts(): Promise<{ conciertos: number; cultura: number; deporte: number }> {
  try {
    const eventos = await getProximosEventos();
    const limit = new Date();
    limit.setDate(limit.getDate() + 7);
    const counts = { conciertos: 0, cultura: 0, deporte: 0 };

    for (const ev of eventos) {
      const d = new Date(ev.date);
      if (isNaN(d.getTime()) || d > limit) continue;
      const cat = normalizeCategory(ev.category);
      if (cat === "Música") counts.conciertos++;
      else if (CULTURA_SET.has(cat)) counts.cultura++;
      else if (DEPORTE_SET.has(cat)) counts.deporte++;
    }
    return counts;
  } catch {
    return { conciertos: 0, cultura: 0, deporte: 0 };
  }
}

export default async function CategoriesGrid() {
  const counts = await getCategoryCounts();

  const categories = [
    { label: "Conciertos", href: "/conciertos", desc: "Música en vivo", tint: "bg-teal/10 border-teal/20", wash: "radial-gradient(420px 160px at 90% -20%, var(--teal-wash), transparent 60%)", icon: Music, count: counts.conciertos },
    { label: "Cultura", href: "/culture", desc: "Teatro, exposiciones", tint: "bg-accent/10 border-accent/20", wash: "radial-gradient(420px 160px at 90% -20%, var(--accent-wash), transparent 60%)", icon: Landmark, count: counts.cultura },
    { label: "Deporte", href: "/deporte", desc: "Running, trail, eventos", tint: "bg-green/10 border-green/20", wash: "radial-gradient(420px 160px at 90% -20%, rgba(43,107,74,0.08), transparent 60%)", icon: Trophy, count: counts.deporte },
    { label: "Cartelera", href: "/movies", desc: "Cine en Vitoria", tint: "bg-blue/10 border-blue/20", wash: "radial-gradient(420px 160px at 90% -20%, rgba(74,124,156,0.08), transparent 60%)", icon: Clapperboard, count: 0 },
  ];

  return (
    <section className="px-5 sm:px-6 py-12 md:py-16 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <h2 className="font-display text-xl md:text-2xl text-fg font-bold tracking-[-0.02em]">
          Explorar por categoría
        </h2>
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {categories.map(({ label, href, desc, tint, wash, icon: Icon, count }) => (
          <Link
            key={href}
            href={href}
            className={`group relative overflow-hidden rounded-2xl border ${tint} p-5 min-h-[124px] flex flex-col justify-between card-hover hover:shadow-lg hover:shadow-accent/10 active:scale-[0.98]`}
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
                {count > 0 ? (
                  <>
                    <span className="font-semibold text-fg">{count}</span>
                    {count === 1 ? " esta semana" : " esta semana"}
                  </>
                ) : (
                  desc
                )}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
