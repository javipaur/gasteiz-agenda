import Link from "next/link";
import type { Evento } from "@/lib/eventos";
import { getAtAGlance } from "@/lib/at-a-glance";
import { CATEGORY_COLORS, normalizeCategory } from "@/lib/categories";

const CHIPS: { label: string; href: string; cat: string }[] = [
  { label: "Música", href: "/conciertos", cat: "Música" },
  { label: "Cine", href: "/movies", cat: "Cine" },
  { label: "Niños", href: "/kids", cat: "Infantil" },
  { label: "Cultura", href: "/culture", cat: "Teatro" },
  { label: "Deporte", href: "/deporte", cat: "Deporte" },
  { label: "Turismo", href: "/turismo", cat: "Visitas" },
  { label: "Gastronomía", href: "/gastronomia", cat: "Gastronomía" },
];

export default function AtAGlanceStrip({
  eventos,
  partidos,
}: {
  eventos: Evento[];
  partidos: number;
}) {
  const { hoy, finde, fechaLabel } = getAtAGlance(eventos);

  return (
    <section aria-label="De un vistazo" className="px-5 sm:px-6 max-w-7xl mx-auto mt-6 md:mt-8">
      <div className="e2e-ataglance rounded-2xl border border-border bg-bg-muted overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-fg-subtle">
            {fechaLabel}
          </span>
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-fg">
            <span className="size-1.5 rounded-full bg-lime" aria-hidden="true" />
            {hoy} planes hoy
          </span>
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-fg">
            <span className="size-1.5 rounded-full bg-violet" aria-hidden="true" />
            {finde} este finde
          </span>
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-fg">
            <span className="size-1.5 rounded-full bg-teal" aria-hidden="true" />
            {partidos} partido{partidos === 1 ? "" : "s"} de los nuestros
          </span>
        </div>
        <div className="flex gap-2 flex-wrap px-5 pb-4">
          {CHIPS.map((c) => {
            const cat = normalizeCategory(c.cat);
            const color = CATEGORY_COLORS[cat] || "#7C8794";
            return (
              <Link
                key={c.href}
                href={c.href}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition-transform duration-300 hover:-translate-y-0.5"
                style={{ backgroundColor: color, color: "#0B0E14" }}
              >
                {c.label}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}