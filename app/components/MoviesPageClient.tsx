"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
    <div className="px-6 max-w-7xl mx-auto pt-24 pb-32">
      <header className="mb-12">
        <p className="font-mono text-sm tracking-widest uppercase text-vermilion mb-3">
          Cine
        </p>
        <h1 className="font-display text-4xl md:text-5xl text-moss-700 mb-3">
          Cartelera
        </h1>
        <p className="text-charcoal-600 max-w-2xl">
          Películas en Vitoria-Gasteiz actualizadas en tiempo real
        </p>
      </header>

      <div className="flex gap-3 mb-10 flex-wrap">
        {CINES.map((cine) => (
          <button
            key={cine.key}
            onClick={() => setFilter(cine.key)}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer ${
              filter === cine.key
                ? "bg-moss-700 text-white shadow-md"
                : "bg-limestone-200 text-charcoal-600 hover:bg-moss-200"
            }`}
          >
            {cine.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="font-mono text-sm text-ink-lighter">
            {filter === "all"
              ? "No hay películas disponibles"
              : `No hay películas en ${filter}`}
          </p>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filtered.map((pelicula, index) => (
            <motion.div
              key={`${pelicula.cine}-${index}`}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.25 }}
            >
              <MovieCard pelicula={pelicula} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      )}
    </div>
  );
}
