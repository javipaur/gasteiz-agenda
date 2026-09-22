"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { InViewWrapper } from "@/lib/shared";
import { SECTION_TINT } from "@/lib/sectionTint";
import { eventSlug } from "@/lib/slug";
import FavoriteButton from "./FavoriteButton";

type Evento = {
  id: string;
  title: string;
  date: string;
  image?: string;
  location: string;
  link: string;
  category: string;
  source: string;
  venue: string;
};

const VENUES = [
  { key: "all", label: "Todos" },
  { key: "jimmy-jazz-gasteiz", label: "Jimmy Jazz" },
  { key: "helldorado", label: "HellDorado" },
  { key: "musikaze", label: "Musikaze" },
];

const VENUE_DESCRIPTIONS: Record<string, string> = {
  "jimmy-jazz-gasteiz": "Sala de conciertos. Indie, rock, pop, jazz.",
  "helldorado": "Rock, punk, metal. Cerveza fría y música fuerte.",
  "musikaze": "Entradas para conciertos en Vitoria-Gasteiz.",
};

function formatEventDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = d.getDate();
  const month = new Intl.DateTimeFormat("es", { month: "short" }).format(d);
  const weekday = new Intl.DateTimeFormat("es", { weekday: "short" }).format(d);
  return `${weekday} ${day} ${month}`;
}

export default function ConciertosPageClient({ eventos }: { eventos: Evento[] }) {
  const [venueFilter, setVenueFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    if (venueFilter === "all") return eventos;
    return eventos.filter((e) => e.source === venueFilter);
  }, [eventos, venueFilter]);

  const grouped = useMemo(() => {
    if (venueFilter !== "all") return null;
    const groups = new Map<string, Evento[]>();
    for (const e of filtered) {
      const v = e.source || "otros";
      if (!groups.has(v)) groups.set(v, []);
      groups.get(v)!.push(e);
    }
    return groups;
  }, [filtered, venueFilter]);

  return (
    <div className="px-5 sm:px-6 max-w-7xl mx-auto pt-28 pb-32">
      <InViewWrapper>
        <header className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <span aria-hidden="true" className={`inline-block h-5 w-[3px] rounded-full ${SECTION_TINT.conciertos.bar}`} />
            <span className={`font-display italic ${SECTION_TINT.conciertos.text} text-sm`}>Música</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl text-fg mb-3 tracking-[-0.02em]">
            Conciertos
          </h1>
          <p className="text-fg-muted max-w-xl">
            Próximos conciertos y eventos musicales en Vitoria-Gasteiz.
          </p>
        </header>
      </InViewWrapper>

      <InViewWrapper delay={0.1}>
        <div className="flex gap-2 mb-10 flex-wrap">
          {VENUES.map((v) => (
            <button
              key={v.key}
              onClick={() => setVenueFilter(v.key)}
              className={`px-4 py-2 text-sm font-medium transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer rounded-full ${
                venueFilter === v.key
                  ? "bg-accent text-white"
                  : "bg-bg-muted text-fg-muted hover:text-fg hover:bg-border"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </InViewWrapper>

      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="font-mono text-sm text-fg-muted mb-2">
            No hay conciertos programados
          </p>
          <p className="text-xs text-fg-subtle">
            Vuelve pronto para ver nuevas fechas
          </p>
        </div>
      ) : venueFilter !== "all" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((evento, index) => (
            <EventCard key={evento.id || index} evento={evento} index={index} />
          ))}
        </div>
      ) : (
        grouped && Array.from(grouped.entries()).map(([venue, events]) => (
          <InViewWrapper key={venue} delay={0.05}>
            <section className="mb-12">
              <div className="flex items-center gap-3 mb-5">
                <h2 className="font-display text-lg font-semibold text-fg capitalize tracking-[-0.01em]">
                  {VENUES.find((v) => v.key === venue)?.label || venue}
                </h2>
                <span className="text-xs text-fg-muted">
                  {VENUE_DESCRIPTIONS[venue] || ""}
                </span>
                <span className="h-px flex-1 bg-border" aria-hidden="true" />
                <span className="font-mono text-xs text-fg-subtle">
                  {events.length}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {events.slice(0, 6).map((evento, index) => (
                  <EventCard key={evento.id || index} evento={evento} index={index} />
                ))}
              </div>
            </section>
          </InViewWrapper>
        ))
      )}
    </div>
  );
}

function EventCard({ evento, index }: { evento: Evento; index: number }) {
  const dateLabel = formatEventDate(evento.date);

  return (
    <InViewWrapper delay={Math.min(index * 0.04, 0.4)}>
      <Link
        href={`/evento/${eventSlug(evento)}`}
        className="group double-bezel-outer rounded-[1.25rem] p-1.5 block focus-visible:outline-2 focus-visible:outline-accent"
      >
        <div className="double-bezel rounded-[calc(1.25rem-0.375rem)] overflow-hidden">
          <div className="aspect-[4/3] relative">
            {evento.image ? (
              <Image
                src={evento.image}
                alt={evento.title}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-[800ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <div className="absolute inset-0 w-full h-full bg-accent-subtle flex items-center justify-center">
                <span className="font-display text-6xl text-accent/20">
                  {evento.title.charAt(0)}
                </span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

            {dateLabel && (
              <div
                className="absolute top-3 left-3 bg-white/15 backdrop-blur-xl rounded-xl px-2.5 py-1.5 text-center leading-tight"
                style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)" }}
              >
                <span className="block font-mono text-[11px] uppercase text-white/70">
                  {dateLabel.split(" ").slice(0, 2).join(" ")}
                </span>
                {evento.date && (
                  <span className="block font-display text-lg text-white">
                    {new Date(evento.date).getDate()}
                  </span>
                )}
              </div>
            )}

            <div className="absolute top-3 right-3">
              <FavoriteButton
                event={{
                  id: evento.id,
                  title: evento.title,
                  date: evento.date,
                  image: evento.image,
                  location: evento.location,
                  link: evento.link,
                }}
              />
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-4">
              <span className="font-mono text-[11px] uppercase tracking-wider text-white/60 mb-1.5 inline-block">
                {VENUES.find((v) => v.key === evento.source)?.label || evento.venue}
              </span>
              <h3 className="font-display text-base font-semibold text-white leading-snug mb-1.5 line-clamp-2">
                {evento.title}
              </h3>
              {evento.location && (
                <p className="font-mono text-xs text-white/70 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-accent inline-block shrink-0" />
                  {evento.location}
                </p>
              )}
            </div>
          </div>
        </div>
      </Link>
    </InViewWrapper>
  );
}
