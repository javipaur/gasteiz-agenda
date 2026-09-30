import Link from "next/link";
import type { Evento } from "@/lib/eventos";
import { localDateStr } from "@/lib/utils";
import SectionHead from "./SectionHead";

export default function TodayStrip({ eventos }: { eventos: Evento[] }) {
  const hoy = localDateStr(new Date());
  const deHoy = eventos
    .filter((e) => e.date && localDateStr(new Date(e.date)) === hoy)
    .sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));

  if (deHoy.length === 0) return null;

  return (
    <section className="px-5 sm:px-6 max-w-7xl mx-auto mt-8 md:mt-10" aria-label="Eventos de hoy">
      <SectionHead tag="Hoy" title="Hoy en Gasteiz" color="var(--lime)" />
      <div className="flex gap-3 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1">
        {deHoy.map((e, i) => (
          <Link
            key={e.id}
            href={`/evento/${e.slug}`}
            className="chip-in group shrink-0 w-[16rem] flex flex-col gap-1.5 rounded-2xl border border-border bg-surface p-4 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-accent/40 hover:-translate-y-0.5"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
              {e.time || "Todo el día"}
            </span>
            <span className="font-display text-base font-semibold text-fg leading-snug line-clamp-2 group-hover:text-accent transition-colors duration-300">
              {e.title}
            </span>
            <span className="mt-auto flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-subtle truncate">
              <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-teal" />
              {e.location || "Vitoria-Gasteiz"}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}