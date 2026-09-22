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
    <section className="relative px-5 sm:px-6 pt-28 pb-10 md:pt-36 md:pb-14">
      <div className="hero-wash" aria-hidden="true" />
      <div className="max-w-5xl mx-auto">
        <InViewWrapper eager>
          <p className="inline-flex items-center gap-2.5 mb-6 font-mono text-[11px] uppercase tracking-[0.2em] text-fg-subtle">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-green opacity-60 animate-ping" />
              <span className="relative inline-flex size-1.5 rounded-full bg-green" />
            </span>
            {totalThisWeek > 0 ? (
              `${totalThisWeek} planes esta semana en Vitoria-Gasteiz`
            ) : (
              "Vitoria-Gasteiz"
            )}
          </p>
        </InViewWrapper>

        <InViewWrapper eager>
          <h1 className="font-display text-[clamp(2.5rem,6.5vw,4.25rem)] font-bold text-fg leading-[1.05] tracking-[-0.03em] mb-4 max-w-3xl">
            Qué hacer en
            <br />
            <span className="text-accent">Vitoria-Gasteiz</span>
          </h1>

          <p className="text-base md:text-lg text-fg-muted max-w-md leading-relaxed mb-8">
            {totalThisWeek > 0
              ? `${totalThisWeek} eventos esta semana. Cultura, deporte, cine y planes para todos.`
              : "Conciertos, exposiciones, cine, deporte y planes familiares."}
          </p>

          <div className="mb-10 max-w-xl">
            <HeroSearch />
          </div>
        </InViewWrapper>
      </div>
    </section>
  );
}