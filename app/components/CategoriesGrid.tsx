import Link from "next/link";
import { getProximosEventos } from "@/lib/eventos";
import { normalizeCategory } from "@/lib/categories";

const CULTURA_SET = new Set(["Teatro", "Exposiciones", "Danza", "Conferencias", "Talleres", "Visitas"]);
const DEPORTE_SET = new Set(["Deporte", "Senderismo"]);

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
    { label: "Conciertos", href: "/conciertos", desc: "Música en vivo", color: "bg-teal", count: counts.conciertos },
    { label: "Cultura", href: "/culture", desc: "Teatro, exposiciones", color: "bg-accent", count: counts.cultura },
    { label: "Deporte", href: "/deporte", desc: "Running, trail, eventos", color: "bg-green", count: counts.deporte },
    { label: "Cartelera", href: "/movies", desc: "Cine en Vitoria", color: "bg-blue", count: 0 },
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
        {categories.map((cat) => (
          <Link
            key={cat.href}
            href={cat.href}
            className="group flex items-center gap-3 p-4 rounded-xl border border-border bg-surface hover:border-border-hover hover:shadow-sm transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
          >
            <span className={`w-2 h-2 rounded-full ${cat.color} shrink-0`} />
            <div className="min-w-0">
              <h3 className="font-display text-sm font-semibold text-fg group-hover:text-accent transition-colors duration-300 truncate">
                {cat.label}
              </h3>
              <p className="text-xs text-fg-muted mt-0.5 truncate">
                {cat.count > 0 ? (
                  <>
                    <span className="text-fg font-medium tabular-nums">{cat.count}</span>
                    {cat.count === 1 ? " esta semana" : " esta semana"}
                  </>
                ) : (
                  cat.desc
                )}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
