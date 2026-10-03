"use client";

import { useMemo } from "react";
import Link from "next/link";
import { InViewWrapper } from "@/lib/shared";
import HeroSearch from "./HeroSearch";
import { getPopularEvents } from "@/lib/popularity";
import { formatDate, shortTime } from "@/lib/utils";
import { CATEGORY_COLORS, normalizeCategory } from "@/lib/categories";
import type { Evento } from "@/lib/eventos";

export default function HeroSection({
  eventos,
  ahora,
}: {
  eventos: Evento[];
  /**
   * El instante contra el que se cuenta la semana, en ms.
   *
   * Antes se leía `new Date()` **dentro** de los dos `useMemo`, y eso es un memo
   * impuro: puede devolver su valor cacheado indefinidamente. La home tiene
   * `revalidate = 300`, así que la cuenta "N planes esta semana" y el destacado
   * se congelaban contra el día con el que se calculó el primer render —abrir la
   * web a las 23:50 y dejarla abierta te dejaba el martes entero en lunes—. Por
   * si fuera poco, `getPopularEvents` sin tercer argumento puntúa con su propio
   * `new Date()`, o sea que el arreglo had de llegar por los dos caminos.
   *
   * `app/page.tsx` (servidor) pasa `Date.now()` como prop, igual que hace
   * `app/culture/page.tsx` con su `eslint-disable react-hooks/purity` justificado.
   * El prop es lo que hace el memo puro: sus deps no incluyen el reloj.
   */
  ahora: number;
}) {
  const totalThisWeek = useMemo(() => {
    const today = new Date(ahora);
    today.setHours(0, 0, 0, 0);
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + 7);
    return eventos.filter((ev) => {
      const d = new Date(ev.date);
      return !isNaN(d.getTime()) && d >= today && d < horizon;
    }).length;
  }, [eventos, ahora]);

  const destacado = useMemo(
    () => getPopularEvents(eventos, 1, new Date(ahora))[0] ?? null,
    [eventos, ahora]
  );

  return (
    <section className="relative px-5 sm:px-6 pt-28 pb-10 md:pt-36 md:pb-14 overflow-hidden">
      <div className="aurora" aria-hidden="true" />
      <div className="relative max-w-5xl mx-auto">
        <InViewWrapper eager>
          <p className="flex items-center gap-3 mb-6">
            <span className="inline-flex items-center font-mono text-[11px] font-bold uppercase tracking-[0.18em] px-3 py-1 rounded-full bg-lime text-on-tint">
              {totalThisWeek > 0 ? `${totalThisWeek} planes esta semana` : "Agenda de la ciudad"}
            </span>
            <span aria-hidden="true" className="h-px w-10 bg-border" />
            <span className="font-mono text-[11px] text-fg-subtle">Vitoria-Gasteiz</span>
          </p>
        </InViewWrapper>

        <InViewWrapper eager>
          <h1 className="font-display text-[clamp(2.5rem,7vw,4.75rem)] font-black uppercase tracking-[-0.04em] leading-[0.98] text-fg mb-5 max-w-3xl">
            La agenda de Vitoria-Gasteiz
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

        {destacado && (
          <InViewWrapper eager delay={0.1} className="hidden lg:block">
            <Link
              href={`/evento/${destacado.slug}`}
              className="group double-bezel rounded-2xl p-4 flex items-center gap-4 card-hover"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={destacado.image}
                alt=""
                className="h-20 w-20 rounded-xl object-cover shrink-0"
              />
              <div className="min-w-0">
                <span
                  className="inline-flex items-center font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: CATEGORY_COLORS[normalizeCategory(destacado.category)] || "var(--fg-subtle)",
                    color: "var(--on-tint)",
                  }}
                >
                  {normalizeCategory(destacado.category)}
                </span>
                <h3 className="font-display text-lg font-black text-fg leading-tight mt-1.5 line-clamp-2">
                  {destacado.title}
                </h3>
                <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-fg-subtle mt-1 truncate">
                  {(() => {
                    const { day, month } = formatDate(destacado.date);
                    const time = shortTime(destacado.time);
                    return `${day} ${month}${time ? ` · ${time}` : ""}${destacado.location ? ` · ${destacado.location}` : ""}`;
                  })()}
                </p>
              </div>
              <span aria-hidden="true" className="ml-auto text-2xl text-fg-subtle group-hover:text-accent transition-colors shrink-0">→</span>
            </Link>
          </InViewWrapper>
        )}
      </div>
    </section>
  );
}
