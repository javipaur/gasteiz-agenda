"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { InViewWrapper } from "@/lib/shared";
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
};

const CATEGORIES = [
  { key: "all", label: "Todos" },
  { key: "agenda", label: "Agenda" },
  { key: "calendario", label: "Calendario" },
  { key: "inscripciones", label: "Inscripciones" },
  { key: "excursiones", label: "Excursiones" },
];

export default function SportPageClient({ eventos }: { eventos: Evento[] }) {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";
  const [filter, setFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    let byCategory = filter === "all"
      ? eventos
      : eventos.filter((e) => e.category === filter);
    if (q) {
      const query = q.toLowerCase();
      byCategory = byCategory.filter(
        (e) =>
          e.title.toLowerCase().includes(query) ||
          e.category.toLowerCase().includes(query) ||
          e.location.toLowerCase().includes(query)
      );
    }
    return byCategory;
  }, [eventos, filter, q]);

  return (
    <div className="px-5 sm:px-6 max-w-7xl mx-auto pt-28 pb-32">
      <InViewWrapper>
        <header className="mb-12">
          <div className="flex items-center gap-2 mb-3">
            <span aria-hidden="true" className="inline-block h-5 w-[3px] rounded-full bg-accent" />
            <span className="font-display italic text-accent text-sm">Deporte</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl text-fg mb-3 tracking-[-0.02em]">
            Agenda Deportiva
          </h1>
          <p className="text-fg-muted max-w-2xl">
            Carreras, senderismo y eventos deportivos en Vitoria-Gasteiz
          </p>
        </header>
      </InViewWrapper>

      <InViewWrapper delay={0.1}>
        <div className="flex gap-2 mb-10 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setFilter(cat.key)}
              className={`px-4 py-2 text-sm font-medium transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer rounded-full ${
                filter === cat.key
                  ? "bg-accent text-white"
                  : "bg-bg-muted text-fg-muted hover:text-fg hover:bg-border"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </InViewWrapper>

      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="font-mono text-sm text-fg-muted mb-2">
            {q
              ? `No hay resultados para "${q}"`
              : `No hay ${filter === "all" ? "eventos" : `eventos de ${filter}`} disponibles`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((evento, index) => {
            const imageUrl =
              evento.image && evento.image.startsWith("http")
                ? evento.image
                : null;
            return (
              <InViewWrapper
                key={evento.title + evento.date + index}
                delay={Math.min(index * 0.04, 0.4)}
              >
                <Link
                  href={`/evento/${eventSlug(evento)}`}
                  className="group double-bezel-outer rounded-[1.25rem] p-1.5 block focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <div className="double-bezel rounded-[calc(1.25rem-0.375rem)] overflow-hidden">
                    <div className="aspect-[4/3] relative">
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={evento.title}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-[800ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105"
                        />
                      ) : (
                        <div className="absolute inset-0 w-full h-full bg-accent-subtle flex items-center justify-center">
                          <span className="font-display text-6xl text-accent/20">
                            {evento.title.charAt(0)}
                          </span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                      <div className="absolute top-3 left-3 bg-white/15 backdrop-blur-xl rounded-xl px-2.5 py-1.5 text-center leading-tight"
                        style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)' }}>
                        <span className="block font-mono text-[11px] uppercase text-white/70">
                          {new Intl.DateTimeFormat("es", { month: "short" }).format(new Date(evento.date)).toUpperCase().replace(".", "")}
                        </span>
                        <span className="block font-display text-lg text-white">
                          {new Date(evento.date).getDate()}
                        </span>
                      </div>
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
                        <span className="font-mono text-[11px] uppercase tracking-wider text-accent bg-accent/20 px-2 py-0.5 inline-block mb-2 rounded">
                          {evento.category}
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
          })}
        </div>
      )}
    </div>
  );
}
