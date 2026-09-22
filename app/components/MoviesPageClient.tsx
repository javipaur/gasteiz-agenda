"use client";

import { useState } from "react";
import { InViewWrapper } from "@/lib/shared";
import MovieCard from "./MovieCard";

type Pelicula = {
  titulo: string;
  duracion: string;
  genero: string;
  imagen: string;
  link: string;
  horarios: string[];
  cine: string;
};

const CINES = [
  { key: "all", label: "Todas" },
  { key: "Florida", label: "Florida" },
  { key: "Boulevard", label: "Boulevard" },
];

export default function MoviesPageClient({ peliculas }: { peliculas: Pelicula[] }) {
  const [filter, setFilter] = useState<string>("all");

  const filtered =
    filter === "all"
      ? peliculas
      : peliculas.filter((p) => p.cine === filter);

  return (
    <div className="px-5 sm:px-6 max-w-7xl mx-auto pt-28 pb-32">
      <InViewWrapper>
        <header className="mb-12">
          <div className="flex items-center gap-2 mb-3">
            <span aria-hidden="true" className="inline-block h-5 w-[3px] rounded-full bg-accent" />
            <span className="font-display italic text-accent text-sm">Cine</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl text-fg mb-3 tracking-[-0.02em]">
            Cartelera
          </h1>
          <p className="text-fg-muted max-w-2xl">
            Películas en Vitoria-Gasteiz actualizadas en tiempo real
          </p>
        </header>
      </InViewWrapper>

      <InViewWrapper delay={0.1}>
        <div className="flex gap-2 mb-10 flex-wrap">
          {CINES.map((cine) => (
            <button
              key={cine.key}
              onClick={() => setFilter(cine.key)}
              className={`px-4 py-2 text-sm font-medium transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer rounded-full ${
                filter === cine.key
                  ? "bg-accent text-white"
                  : "bg-bg-muted text-fg-muted hover:text-fg hover:bg-border"
              }`}
            >
              {cine.label}
            </button>
          ))}
        </div>
      </InViewWrapper>

      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="font-mono text-sm text-fg-muted">
            {filter === "all"
              ? "No hay películas disponibles"
              : `No hay películas en ${filter}`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((pelicula, index) => (
            <InViewWrapper
              key={`${pelicula.cine}-${index}`}
              delay={Math.min(index * 0.04, 0.4)}
            >
              <MovieCard pelicula={pelicula} />
            </InViewWrapper>
          ))}
        </div>
      )}
    </div>
  );
}
