"use client";

import { useMemo } from "react";
import { InViewWrapper } from "@/lib/shared";
import HeroSearch from "./HeroSearch";

type Evento = {
  id: string;
  title: string;
  date: string;
  image?: string;
  location?: string;
  link?: string;
  category?: string;
  source?: string;
  time?: string;
};

export default function HeroSection({ eventos }: { eventos: Evento[] }) {
  const totalThisWeek = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + 7);
    return eventos.filter((ev) => {
      const d = new Date(ev.date);
      return !isNaN(d.getTime()) && d >= today && d < horizon;
    }).length;
  }, [eventos]);

  return (
    <section className="relative px-5 sm:px-6 pt-28 pb-10 md:pt-36 md:pb-14 overflow-hidden">
      <div className="hero-grid" aria-hidden="true" />
      <div className="max-w-5xl mx-auto">
        <InViewWrapper eager>
          <p className="flex items-center gap-3 mb-7">
            <span aria-hidden="true" className="inline-block h-6 w-[3px] rounded-full bg-accent" />
            <span className="text-sm font-medium text-fg">
              {totalThisWeek > 0
                ? `${totalThisWeek} planes para esta semana`
                : "Agenda de la ciudad"}
            </span>
            <span aria-hidden="true" className="h-px w-10 bg-border" />
            <span className="font-mono text-[11px] text-fg-subtle">Vitoria-Gasteiz</span>
          </p>
        </InViewWrapper>

        <InViewWrapper eager>
          <h1 className="font-display text-[clamp(2.75rem,7vw,5rem)] font-semibold text-fg leading-[1.03] tracking-[-0.02em] mb-5 max-w-3xl">
            La agenda de
            <span className="block font-display italic font-medium text-accent">
              Vitoria-Gasteiz
            </span>
          </h1>

          <p className="text-base md:text-lg text-fg-muted max-w-md leading-relaxed mb-8">
            {totalThisWeek > 0
              ? `Conciertos, teatro, cine, deporte y planes familiares: ${totalThisWeek} propuestas confirmadas.`
              : "Conciertos, exposiciones, cine, deporte y planes familiares, recogidos en un solo sitio."}
          </p>

          <div className="mb-10 max-w-xl">
            <HeroSearch />
          </div>
        </InViewWrapper>
      </div>
    </section>
  );
}