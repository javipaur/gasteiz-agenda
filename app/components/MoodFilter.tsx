"use client";

import { useState, useMemo } from "react";
import { InViewWrapper, EventCard } from "@/lib/shared";
import { CATEGORY_COLORS } from "@/lib/categories";
import type { Evento } from "@/lib/eventos";
import type { PeliculaConCine } from "@/lib/cines";
import MovieCard from "./MovieCard";

type Mood = {
  id: string;
  label: string;
  categories: Set<string>;
  emoji?: string;
};

const MOODS: Mood[] = [
  { id: "todo", label: "Para todo", categories: new Set() },
  {
    id: "musica",
    label: "Música en vivo",
    categories: new Set(["Conciertos", "Música"]),
  },
  {
    id: "cultura",
    label: "Cultura",
    categories: new Set([
      "Teatro",
      "Exposiciones",
      "Cultura",
      "Visitas",
      "Danza",
      "Conferencias",
      "Talleres",
    ]),
  },
  { id: "familiar", label: "Familiar", categories: new Set(["Infantil", "Kids"]) },
  { id: "deporte", label: "Deporte", categories: new Set(["Deporte", "Senderismo"]) },
  { id: "gastro", label: "Gastronomía", categories: new Set(["Gastronomía"]) },
  { id: "cine", label: "Cine", categories: new Set(["Cine"]) },
];

export default function MoodFilter({
  eventos,
  peliculas = [],
}: {
  eventos: Evento[];
  peliculas?: PeliculaConCine[];
}) {
  const [active, setActive] = useState<string>("todo");
  const [cineFilter, setCineFilter] = useState<"all" | "Florida" | "Boulevard">("all");

  const handleSetActive = (id: string) => {
    setActive(id);
    setCineFilter("all");
  };

  const counts = useMemo(() => {
    const map: Record<string, number> = { todo: eventos.length };
    for (const mood of MOODS) {
      if (mood.id === "todo") continue;
      map[mood.id] = 0;
    }
    for (const ev of eventos) {
      const cat = ev.category || "";
      for (const mood of MOODS) {
        if (mood.id === "todo") continue;
        if (mood.categories.has(cat)) map[mood.id] = (map[mood.id] || 0) + 1;
      }
    }
    if (peliculas.length > 0) map.cine = peliculas.length;
    return map;
  }, [eventos, peliculas]);

  const filtered = useMemo(() => {
    const mood = MOODS.find((m) => m.id === active);
    if (!mood || mood.id === "todo") return [];
    return eventos
      .filter((e) => mood.categories.has(e.category || ""))
      .slice(0, 8);
  }, [eventos, active]);

  const filteredPeliculas = useMemo(() => {
    if (cineFilter === "all") return peliculas;
    return peliculas.filter((p) => p.cine === cineFilter);
  }, [peliculas, cineFilter]);

  const activeMood = MOODS.find((m) => m.id === active);

  return (
    <section className="px-5 sm:px-6 py-8 md:py-10">
      <div className="max-w-5xl mx-auto">
        <InViewWrapper>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="font-display text-lg md:text-xl text-fg font-semibold tracking-[-0.02em]">
              ¿Qué te apetece?
            </h2>
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
          </div>

          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
            {MOODS.map((mood) => (
              <button
                key={mood.id}
                onClick={() => handleSetActive(mood.id)}
                aria-pressed={active === mood.id}
                className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer ${
                  active === mood.id
                    ? "bg-accent text-white shadow-lg shadow-accent/20 ring-1 ring-white/20 ring-inset scale-[1.02]"
                    : "bg-surface border border-border text-fg-muted hover:text-fg hover:border-accent/30"
                }`}
              >
                {mood.label}
                {mood.id !== "todo" && counts[mood.id] !== undefined && (
                  <span
                    className={`font-mono text-[10px] tabular-nums ${
                      active === mood.id ? "text-white/80" : "text-fg-subtle"
                    }`}
                  >
                    {counts[mood.id]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </InViewWrapper>

        {activeMood && activeMood.id !== "todo" && (
          <div key={active} className="mt-6 panel-in">
            {active === "cine" ? (
              <div>
                <div className="flex gap-2 mb-5 flex-wrap">
                  {(["all", "Florida", "Boulevard"] as const).map((cine) => (
                    <button
                      key={cine}
                      onClick={() => setCineFilter(cine)}
                      className={`px-4 py-2 text-sm font-medium transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer rounded-full ${
                        cineFilter === cine
                          ? "bg-accent text-white"
                          : "bg-bg-muted text-fg-muted hover:text-fg hover:bg-border"
                      }`}
                    >
                      {cine === "all" ? "Todas" : cine}
                    </button>
                  ))}
                </div>

                {filteredPeliculas.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredPeliculas.map((pelicula) => (
                      <MovieCard key={`${pelicula.cine}-${pelicula.titulo}`} pelicula={pelicula} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-center py-8">
                    <p className="text-fg-muted text-sm">
                      {cineFilter === "all"
                        ? "No hay películas disponibles ahora mismo."
                        : `No hay películas en ${cineFilter} ahora mismo.`}
                    </p>
                  </div>
                )}

                <div className="mt-6">
                  <a
                    href="/movies"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover transition-colors duration-300 group"
                  >
                    Ver la cartelera completa
                    <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-0.5">
                      →
                    </span>
                  </a>
                </div>
              </div>
            ) : filtered.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {filtered.map((evento, i) => (
                  <EventCard
                    key={evento.id}
                    evento={evento}
                    showCategory
                    showSource
                    categoryColors={CATEGORY_COLORS}
                    priority={i < 4}
                  />
                ))}
              </div>
            ) : (
              <p className="text-fg-muted text-sm py-4">
                No hay planes de{" "}
                <span className="text-fg font-medium">{activeMood.label}</span>{" "}
                en los próximos días. Prueba con otra ambientación.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}