"use client";

import Image from "next/image";
import { useFavorites } from "@/app/context/FavoritesContext";
import Link from "next/link";

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return {
    day: isNaN(d.getTime()) ? "??" : d.getDate(),
    month: isNaN(d.getTime()) ? "???" : new Intl.DateTimeFormat("es", { month: "short" }).format(d).toUpperCase().replace(".", ""),
    full: !isNaN(d.getTime())
      ? d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })
      : "",
  };
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21.5l-1.5-1.3C4.5 16 2 13.3 2 10c0-3 2.3-5.5 5-5.5 1.6 0 3 .8 4 2 1-1.2 2.4-2 4-2 2.7 0 5 2.5 5 5.5 0 3.3-2.5 6-8.5 10.2L12 21.5z" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4h12M5 4V2.5A.5.5 0 015.5 2h3a.5.5 0 01.5.5V4M12.5 4l-.5 9.5a1 1 0 01-1 .9H5a1 1 0 01-1-.9L3.5 4" />
    </svg>
  );
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 11l8-8M5 3h6v6" />
    </svg>
  );
}

export default function FavoritosPage() {
  const { favorites, toggleFavorite, count } = useFavorites();

  return (
    <div className="px-5 sm:px-6 max-w-7xl mx-auto pt-28 pb-32">
      <header className="mb-12">
        <p className="font-mono text-xs tracking-[0.2em] uppercase text-accent mb-3">
          Favoritos
        </p>
        <h1 className="font-display text-4xl md:text-5xl text-fg mb-3 tracking-[-0.02em]">
          Tus Eventos Guardados
        </h1>
        <p className="text-fg-muted max-w-2xl">
          {count > 0
            ? `Tienes ${count} ${count === 1 ? "evento guardado" : "eventos guardados"}`
            : "Aún no has guardado ningún evento. Explora la agenda y añade eventos a tus favoritos."}
        </p>
      </header>

      {count === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <HeartIcon className="w-16 h-16 text-fg-subtle mb-6" />
          <p className="font-display text-xl text-fg-muted mb-6">
            No hay favoritos todavía
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-full text-sm font-medium hover:bg-accent-hover transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
          >
            Ver eventos
            <ArrowIcon className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {favorites.map((evento) => {
            const { day, month } = formatDate(evento.date);
            return (
              <div
                key={evento.id}
                className="group double-bezel-outer rounded-[1.25rem] p-1.5"
              >
                <div className="double-bezel rounded-[calc(1.25rem-0.375rem)] overflow-hidden">
                  <a
                    href={evento.link || "#"}
                    target={evento.link ? "_blank" : undefined}
                    rel={evento.link ? "noopener noreferrer" : undefined}
                    className="block focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    <div className="aspect-[4/3] relative">
                      {evento.image ? (
                        <Image
                          src={evento.image}
                          alt={evento.title}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          className="object-cover transition-transform duration-[800ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105"
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
                          {month}
                        </span>
                        <span className="block font-display text-lg text-white">
                          {day}
                        </span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleFavorite(evento);
                        }}
                        aria-label="Quitar de favoritos"
                        className="absolute top-3 right-3 z-10 flex items-center justify-center w-11 h-11 rounded-full bg-white/30 backdrop-blur-xl text-accent hover:scale-110 active:scale-[0.92] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
                        style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)' }}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>

                      <div className="absolute bottom-0 left-0 right-0 p-4">
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
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
