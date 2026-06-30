"use client";

import { useFavorites } from "@/app/context/FavoritesContext";
import { Heart, Trash2 } from "lucide-react";
import Link from "next/link";

const MONTHS = [
  "ENE", "FEB", "MAR", "ABR", "MAY", "JUN",
  "JUL", "AGO", "SEP", "OCT", "NOV", "DIC",
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return {
    day: d.getDate(),
    month: MONTHS[d.getMonth()],
    full: d.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  };
}

export default function FavoritosPage() {
  const { favorites, toggleFavorite, count } = useFavorites();

  return (
    <div className="px-6 max-w-7xl mx-auto pt-24 pb-32">
      <header className="mb-12">
        <p className="font-mono text-sm tracking-widest uppercase text-vermilion mb-3">
          Favoritos
        </p>
        <h1 className="font-display text-4xl md:text-5xl text-moss-700 mb-3">
          Tus Eventos Guardados
        </h1>
        <p className="text-charcoal-600 max-w-2xl">
          {count > 0
            ? `Tienes ${count} ${count === 1 ? "evento guardado" : "eventos guardados"}`
            : "Aún no has guardado ningún evento. Explora la agenda y añade eventos a tus favoritos."}
        </p>
      </header>

      {count === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Heart size={64} className="text-charcoal-400 mb-6" />
          <p className="font-display text-xl text-charcoal-600 mb-4">
            No hay favoritos todavía
          </p>
          <Link
            href="/"
            className="font-mono text-sm uppercase tracking-wider bg-vermilion text-white px-6 py-3 rounded-full hover:bg-vermilion-600 transition-colors"
          >
            Ver eventos
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {favorites.map((evento) => {
            const { day, month } = formatDate(evento.date);
            return (
              <div
                key={evento.id}
                className="group relative overflow-hidden rounded-2xl"
              >
                <a
                  href={evento.link || "#"}
                  target={evento.link ? "_blank" : undefined}
                  rel={evento.link ? "noopener noreferrer" : undefined}
                  className="block focus-visible:outline-2 focus-visible:outline-vermilion"
                >
                  <div className="aspect-[4/3] relative">
                    {evento.image ? (
                      <img
                        src={evento.image}
                        alt={evento.title}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div className="absolute inset-0 w-full h-full bg-moss-500/30 flex items-center justify-center">
                        <span className="font-display text-6xl text-white/20">
                          {evento.title.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                    <div className="absolute top-3 left-3 bg-white/20 backdrop-blur-sm rounded-lg px-2.5 py-1.5 text-center leading-tight">
                      <span className="block font-mono text-[11px] uppercase text-white/80">
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
                      className="absolute top-3 right-3 z-10 flex items-center justify-center w-9 h-9 rounded-full bg-white/30 backdrop-blur-sm text-vermilion hover:scale-110 transition-all duration-200"
                    >
                      <Trash2 size={16} />
                    </button>

                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 className="font-display text-base font-semibold text-white leading-snug mb-1.5 line-clamp-2">
                        {evento.title}
                      </h3>
                      {evento.location && (
                        <p className="font-mono text-xs text-white/70 flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-vermilion inline-block shrink-0" />
                          {evento.location}
                        </p>
                      )}
                    </div>
                  </div>
                </a>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
