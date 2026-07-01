"use client";

import { useState, useMemo, useRef, useEffect } from "react";
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
  source: string;
};

const CATEGORIES = [
  { key: "all", label: "Todos" },
  { key: "agenda", label: "Agenda" },
  { key: "teatro", label: "Teatro" },
  { key: "conciertos", label: "Conciertos" },
  { key: "exposiciones", label: "Exposiciones" },
];

const SOURCE_PILLS: Record<string, { key: string; label: string }[]> = {
  conciertos: [
    { key: "all", label: "Todos" },
    { key: "jimmyjazz", label: "Jimmy Jazz" },
    { key: "vam", label: "VAM Cultura" },
    { key: "municipal", label: "Agenda" },
    { key: "fever", label: "Fever" },
    { key: "lagenterula", label: "Rula" },
    { key: "gasteizhoy", label: "Gasteiz Hoy" },
  ],
};

const SOURCE_LABELS: Record<string, string> = {
  jimmyjazz: "Jimmy Jazz",
  vam: "VAM Cultura",
  municipal: "Agenda Municipal",
  fever: "Fever",
  lagenterula: "Rula",
  gasteizhoy: "Gasteiz Hoy",
};

const MONTHS = [
  "ENE", "FEB", "MAR", "ABR", "MAY", "JUN",
  "JUL", "AGO", "SEP", "OCT", "NOV", "DIC",
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return {
    day: isNaN(d.getTime()) ? "?" : d.getDate(),
    month: isNaN(d.getTime()) ? "???" : MONTHS[d.getMonth()],
  };
}

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

export default function CulturePageClient({ eventos }: { eventos: Evento[] }) {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";
  const [filter, setFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    let byCategory = filter === "all"
      ? eventos
      : eventos.filter((e) => e.category === filter);
    if (filter === "conciertos" && sourceFilter !== "all") {
      byCategory = byCategory.filter((e) => e.source === sourceFilter);
    }
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
  }, [eventos, filter, sourceFilter, q]);

  const handleCategoryChange = (key: string) => {
    setFilter(key);
    setSourceFilter("all");
  };

  return (
    <div className="px-4 max-w-7xl mx-auto pt-28 pb-32">
      <InViewWrapper>
        <header className="mb-12">
          <p className="font-mono text-xs tracking-[0.2em] uppercase text-accent mb-3">
            Cultura
          </p>
          <h1 className="font-display text-4xl md:text-5xl text-fg mb-3 tracking-[-0.02em]">
            Agenda Cultural
          </h1>
          <p className="text-fg-muted max-w-2xl">
            Teatro, conciertos, exposiciones y eventos en Vitoria-Gasteiz
          </p>
        </header>
      </InViewWrapper>

      <InViewWrapper delay={0.1}>
        <div className="flex gap-2 mb-4 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => handleCategoryChange(cat.key)}
              className={`px-4 py-2 text-sm font-medium transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer ${
                filter === cat.key
                  ? "bg-accent text-white"
                  : "bg-bg-muted text-fg-muted hover:text-fg hover:bg-border"
              }`}
              style={{ borderRadius: filter === cat.key ? '999px' : '999px' }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {filter === "conciertos" && SOURCE_PILLS.conciertos && (
          <div className="flex gap-2 mb-8 flex-wrap">
            {SOURCE_PILLS.conciertos.map((pill) => (
              <button
                key={pill.key}
                onClick={() => setSourceFilter(pill.key)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 cursor-pointer ${
                  sourceFilter === pill.key
                    ? "bg-accent text-white"
                    : "bg-bg-muted text-fg-subtle hover:text-fg-muted"
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        )}
      </InViewWrapper>

      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="font-mono text-sm text-fg-muted mb-2">
            {q
              ? `No hay resultados para "${q}"`
              : `No hay ${filter === "all" ? "eventos" : `eventos de ${filter}`} disponibles`}
          </p>
          {q && (
            <p className="text-xs text-fg-subtle">
              Prueba con otros términos o explora las categorías
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <AnimatePresence mode="popLayout">
            {filtered.map((evento, index) => {
              const { day, month } = formatDate(evento.date);
              const imageUrl =
                evento.image && evento.image.startsWith("http")
                  ? evento.image
                  : null;
              return (
                <motion.div
                  key={evento.id || evento.title + evento.date + index}
                  layout
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                >
                  <a
                    href={evento.link || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group double-bezel-outer rounded-[1.25rem] p-1.5 block focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    <div className="double-bezel rounded-[calc(1.25rem-0.375rem)] overflow-hidden">
                      <div className="aspect-[4/3] relative">
                        {imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={evento.title}
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-[800ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105"
                            loading="lazy"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                              const fallback = (e.target as HTMLImageElement).nextElementSibling;
                              if (fallback) fallback.classList.remove("hidden");
                            }}
                          />
                        ) : null}
                        <div className={`absolute inset-0 w-full h-full bg-accent-subtle flex items-center justify-center ${imageUrl ? "hidden" : ""}`}>
                          <span className="font-display text-6xl text-accent/20">
                            {evento.title.charAt(0)}
                          </span>
                        </div>
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
                          <span className="font-mono text-[10px] uppercase tracking-wider text-accent bg-accent/20 px-2 py-0.5 inline-block mb-2"
                            style={{ borderRadius: '4px' }}>
                            {evento.category === "conciertos" && evento.source
                              ? SOURCE_LABELS[evento.source] || evento.source
                              : evento.category}
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
                  </a>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
