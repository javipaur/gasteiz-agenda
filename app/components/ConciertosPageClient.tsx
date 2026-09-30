"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { InViewWrapper } from "@/lib/shared";
import { SECTION_TINT } from "@/lib/sectionTint";
import { isTicketSource } from "@/lib/tickets";
import { SOURCE_LABELS, sourceGroup } from "@/lib/source-data";
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

/**
 * Clave con la que se agrupan y se filtran los conciertos.
 *
 * `/conciertos` sigue sacando `source` del nombre del recinto
 * (`app/conciertos/page.tsx`: `venue.toLowerCase().replace(/\s+/g, "-")`), así que
 * lo que llega aquí es un slug de recinto ("jimmy-jazz-gasteiz") y no un id del
 * registro. `sourceGroup` no cambia nada mientras siga siendo así, y deja el mismo
 * código preparado para cuando la página emita ids del registro.
 */
function recintoKey(e: Evento): string {
  return sourceGroup({ id: e.source });
}

/**
 * Etiqueta de un recinto. `SOURCE_LABELS` cubre el día que `source` sea un id del
 * registro; mientras siga siendo un slug de recinto, el nombre del recinto es la
 * etiqueta verdadera, y el slug a secas se vería en crudo.
 */
function recintoLabel(e: Evento): string {
  return SOURCE_LABELS[recintoKey(e)] ?? e.venue ?? recintoKey(e);
}

/**
 * Textos de presentación, uno por recinto, resueltos por la clave de agrupación.
 * Si una fuente cambia de id se pierde la descripción —que es texto— pero nunca el
 * filtro, que es lo que estaba roto: las claves estaban escritas a mano, así que
 * cualquier id que nadie emitiera dejaba la página vacía al pulsarlo.
 */
const VENUE_DESCRIPTIONS: Record<string, string> = {
  "jimmy-jazz-gasteiz": "Sala de conciertos. Indie, rock, pop, jazz.",
  helldorado: "Rock, punk, metal. Cerveza fría y música fuerte.",
  musikaze: "Entradas para conciertos en Vitoria-Gasteiz.",
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

  /**
   * Los filtros salen de los eventos que hay, no de una lista escrita a mano. Es
   * la diferencia entre una pill que no coincide con nada y una página vacía al
   * pulsarla: aquí una clave solo existe si alguna fuente la emite.
   */
  const recintos = useMemo(() => {
    const porClave = new Map<string, { key: string; label: string }>();
    for (const e of eventos) {
      const key = recintoKey(e);
      if (!porClave.has(key)) porClave.set(key, { key, label: recintoLabel(e) });
    }
    return [{ key: "all", label: "Todos" }, ...porClave.values()];
  }, [eventos]);

  const filtered = useMemo(() => {
    if (venueFilter === "all") return eventos;
    return eventos.filter((e) => recintoKey(e) === venueFilter);
  }, [eventos, venueFilter]);

  const grouped = useMemo(() => {
    if (venueFilter !== "all") return null;
    const groups = new Map<string, Evento[]>();
    for (const e of filtered) {
      const v = recintoKey(e) || "otros";
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
          {recintos.map((v) => (
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
                  {recintos.find((v) => v.key === venue)?.label || recintoLabel(events[0])}
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

function TicketIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 4.5h14v7H1z" />
      <path d="M5.5 6v4M8 6v4M10.5 6v4" />
    </svg>
  );
}

function EventCard({ evento, index }: { evento: Evento; index: number }) {
  const dateLabel = formatEventDate(evento.date);

  return (
    <InViewWrapper delay={Math.min(index * 0.04, 0.4)}>
      <div className="group double-bezel-outer rounded-[1.25rem] p-1.5 block">
        <div className="double-bezel rounded-[calc(1.25rem-0.375rem)] overflow-hidden">
          <Link
            href={`/evento/${eventSlug(evento)}`}
            className="block focus-visible:outline-2 focus-visible:outline-accent"
          >
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
                {recintoLabel(evento)}
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
          </Link>

          {evento.link && (
            <div className="p-4 bg-surface">
              <a
                href={evento.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-accent text-white text-center py-3 font-medium text-sm hover:bg-accent-hover transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
                style={{ borderRadius: "999px" }}
              >
                <span>{isTicketSource(evento.source) ? "Comprar entradas" : "Más información"}</span>
                <TicketIcon className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>
      </div>
    </InViewWrapper>
  );
}
