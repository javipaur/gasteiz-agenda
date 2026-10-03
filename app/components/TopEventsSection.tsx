"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { InViewWrapper } from "@/lib/shared";
import { formatDate, shortTime } from "@/lib/utils";
import type { Evento } from "@/lib/eventos";
import SectionHead from "./SectionHead";
import { comportamientoDeDesplazamiento } from "./motion";

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3l5 5-5 5" />
    </svg>
  );
}

export default function TopEventsSection({
  events,
}: {
  events: (Evento & { ranking: number })[];
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  function scrollBy(dir: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: comportamientoDeDesplazamiento() });
  }

  if (events.length < 4) return null;

  return (
    <section className="px-5 sm:px-6 py-10 md:py-14 bg-bg-muted">
      <div className="max-w-7xl mx-auto">
        <InViewWrapper>
          <div className="flex items-end justify-between gap-4 mb-6">
            <SectionHead
              tag="Top 10"
              title="Top 10 en Vitoria-Gasteiz"
              subtitle="Los planes que más suenan esta semana"
              color="var(--amber)"
            />
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => scrollBy(-1)}
                aria-label="Anterior"
                // `size-11` en vez de `size-9`: eran 36×36 y son el único modo de
                // desplazar este riel sin rueda ni arrastre.
                className="grid size-11 place-items-center rounded-full border border-border bg-surface text-fg-muted hover:text-accent hover:border-accent/40 transition-all duration-300 active:scale-[0.92] cursor-pointer"
              >
                <ArrowIcon className="w-4 h-4 rotate-180" />
              </button>
              <button
                onClick={() => scrollBy(1)}
                aria-label="Siguiente"
                className="grid size-11 place-items-center rounded-full border border-border bg-surface text-fg-muted hover:text-accent hover:border-accent/40 transition-all duration-300 active:scale-[0.92] cursor-pointer"
              >
                <ArrowIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </InViewWrapper>

        <InViewWrapper>
          <div
            ref={scrollerRef}
            className="flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory pb-2 -mx-1 px-1"
          >
            {events.map((evento) => {
              const { day, month } = formatDate(evento.date);
              const time = shortTime(evento.time);
              return (
                <Link
                  key={evento.id}
                  href={`/evento/${evento.slug}`}
                  className="group relative shrink-0 snap-start w-36 sm:w-44 bg-surface border border-border rounded-2xl overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1 hover:shadow-lg hover:shadow-accent/5 active:scale-[0.97]"
                >
                  <div className="relative aspect-[3/4] bg-bg-muted">
                    {evento.image ? (
                      <Image
                        src={evento.image}
                        /* `alt=""`: la imagen y el título comparten el `<a>` de la tarjeta, así que con el
                           `alt` puesto el lector anunciaba el evento dos veces. */
                        alt=""
                        fill
                        sizes="180px"
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-[800ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-accent-subtle">
                        <span className="font-display text-4xl text-accent/25">
                          {evento.title.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    <span className="absolute top-2.5 left-2.5 grid size-9 place-items-center rounded-xl bg-black/50 backdrop-blur-md font-display text-lg font-semibold text-white border border-white/20 shadow-lg shadow-black/20">
                      {evento.ranking}
                    </span>

                    {evento.rating && evento.rating > 0 && (
                      <span className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full bg-black/50 backdrop-blur-md px-2 py-1 font-mono text-[10px] text-amber-300 border border-white/15">
                        <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor"><path d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 14.9l-5.3 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z" /></svg>
                        {evento.rating.toFixed(1).replace(".", ",")}
                      </span>
                    )}

                    <div className="absolute bottom-0 left-0 right-0 p-2.5">
                      <p className="font-mono text-[10px] uppercase tracking-wide text-white/70 flex items-center gap-1">
                        {month} · {day}
                        {time && <span aria-hidden="true">·</span>}
                        {time && <span className="text-white">{time}</span>}
                      </p>
                      <h3 className="font-display text-sm font-semibold text-white leading-snug line-clamp-2 mt-0.5">
                        {evento.title}
                      </h3>
                      {evento.location && (
                        <p className="font-mono text-[10px] text-white/70 truncate mt-0.5">
                          {evento.location}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </InViewWrapper>
      </div>
    </section>
  );
}