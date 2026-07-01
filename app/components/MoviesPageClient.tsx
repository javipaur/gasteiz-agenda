"use client";

import { useState, useRef, useEffect } from "react";
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

function InViewWrapper({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.05 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: `all 0.8s cubic-bezier(0.32, 0.72, 0, 1) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

export default function MoviesPageClient({ peliculas }: { peliculas: Pelicula[] }) {
  const [filter, setFilter] = useState<string>("all");

  const filtered =
    filter === "all"
      ? peliculas
      : peliculas.filter((p) => p.cine === filter);

  return (
    <div className="px-4 max-w-7xl mx-auto pt-28 pb-32">
      <InViewWrapper>
        <header className="mb-12">
          <p className="font-mono text-xs tracking-[0.2em] uppercase text-accent mb-3">
            Cine
          </p>
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
              className={`px-4 py-2 text-sm font-medium transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer ${
                filter === cine.key
                  ? "bg-accent text-white"
                  : "bg-bg-muted text-fg-muted hover:text-fg hover:bg-border"
              }`}
              style={{ borderRadius: '999px' }}
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
          <AnimatePresence mode="popLayout">
            {filtered.map((pelicula, index) => (
              <motion.div
                key={`${pelicula.cine}-${index}`}
                layout
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
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
