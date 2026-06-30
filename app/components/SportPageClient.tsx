"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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

const MONTHS = [
  "ENE", "FEB", "MAR", "ABR", "MAY", "JUN",
  "JUL", "AGO", "SEP", "OCT", "NOV", "DIC",
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return {
    day: d.getDate(),
    month: MONTHS[d.getMonth()],
  };
}

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
    <div className="px-6 max-w-7xl mx-auto pt-24 pb-32">
      <header className="mb-12">
        <p className="font-mono text-sm tracking-widest uppercase text-vermilion mb-3">
          Deporte
        </p>
        <h1 className="font-display text-4xl md:text-5xl text-moss-700 mb-3">
          Agenda Deportiva
        </h1>
        <p className="text-charcoal-600 max-w-2xl">
          Carreras, senderismo y eventos deportivos en Vitoria-Gasteiz
        </p>
      </header>

      <div className="flex gap-3 mb-10 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setFilter(cat.key)}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-all cursor-pointer ${
              filter === cat.key
                ? "bg-moss-700 text-white shadow-md"
                : "bg-limestone-200 text-charcoal-600 hover:bg-moss-200"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="font-mono text-sm text-ink-lighter mb-2">
            {q
              ? `No hay resultados para "${q}"`
              : `No hay ${filter === "all" ? "eventos" : `eventos de ${filter}`} disponibles`}
          </p>
          {q && (
            <p className="text-xs text-ink-lighter">
              Prueba con otros términos o explora las categorías
            </p>
          )}
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {filtered.map((evento, index) => {
            const { day, month } = formatDate(evento.date);
            const imageUrl =
              evento.image && evento.image.startsWith("http")
                ? evento.image
                : null;
            return (
              <motion.a
                key={evento.title + evento.date + index}
                href={evento.link || "#"}
                target="_blank"
                rel="noopener noreferrer"
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.25 }}
                className="group relative overflow-hidden rounded-2xl block focus-visible:outline-2 focus-visible:outline-vermilion"
              >
                <div className="aspect-[4/3] relative">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
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
                    <span className="font-mono text-[10px] uppercase tracking-wider text-vermilion bg-vermilion/20 px-2 py-0.5 rounded-full inline-block mb-2">
                      {evento.category}
                    </span>
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
              </motion.a>
            );
          })}
        </AnimatePresence>
      </div>
      )}
    </div>
  );
}
