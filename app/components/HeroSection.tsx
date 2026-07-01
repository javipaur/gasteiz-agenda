"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import FavoriteButton from "./FavoriteButton";
import { normalizeCategory, CATEGORY_COLORS } from "@/lib/categories";

type Evento = {
  id: string;
  title: string;
  date: string;
  image?: string;
  location?: string;
  link?: string;
  category?: string;
  source?: string;
  time?: string;
};

type DayGroup = {
  date: string;
  label: string;
  isToday: boolean;
  count: number;
  events: Evento[];
};

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatSpanishDate(dateStr: string) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { day: "??", month: "???", year: "" };
  const months = [
    "ENE", "FEB", "MAR", "ABR", "MAY", "JUN",
    "JUL", "AGO", "SEP", "OCT", "NOV", "DIC",
  ];
  return {
    day: String(d.getDate()).padStart(2, "0"),
    month: months[d.getMonth()],
    year: String(d.getFullYear()),
  };
}

function formatDate(dateStr: string): { day: string; month: string } {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { day: "??", month: "???" };
  const months = [
    "ENE", "FEB", "MAR", "ABR", "MAY", "JUN",
    "JUL", "AGO", "SEP", "OCT", "NOV", "DIC",
  ];
  return {
    day: String(d.getDate()).padStart(2, "0"),
    month: months[d.getMonth()],
  };
}

function sourceLabel(source?: string): string {
  switch (source) {
    case "rula": return "Rula";
    case "gasteizhoy": return "Gasteiz Hoy";
    case "fever": return "Fever";
    case "vam": return "VAM";
    case "euskadi": return "Euskadi";
    default: return source || "";
  }
}

function InViewWrapper({ children, className }: { children: React.ReactNode; className?: string }) {
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
        transition: 'all 0.8s cubic-bezier(0.32, 0.72, 0, 1)',
      }}
    >
      {children}
    </div>
  );
}

export default function HeroSection({ eventos }: { eventos: Evento[] }) {
  const [selectedDay, setSelectedDay] = useState<number | null>(0);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const weekDays: DayGroup[] = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const groups: DayGroup[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = localDateStr(date);
      const daysOfWeek = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
      groups.push({
        date: dateStr,
        label: i === 0 ? "HOY" : daysOfWeek[date.getDay()],
        isToday: i === 0,
        count: 0,
        events: [],
      });
    }

    for (const ev of eventos) {
      const evDate = new Date(ev.date);
      if (isNaN(evDate.getTime())) continue;
      const evDateStr = localDateStr(evDate);
      const found = groups.find((g) => g.date === evDateStr);
      if (found) found.events.push(ev);
    }

    for (const g of groups) g.count = g.events.length;

    return groups;
  }, [eventos]);

  const toggleDay = useCallback((idx: number) => {
    setSelectedDay((prev) => (prev === idx ? null : idx));
    setCategoryFilter("all");
  }, []);

  const dayEvents = useMemo(() => {
    const raw = selectedDay !== null ? weekDays[selectedDay]?.events || [] : [];
    return raw.map((e) => ({ ...e, category: normalizeCategory(e.category) }));
  }, [selectedDay, weekDays]);

  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    dayEvents.forEach((e) => { if (e.category) cats.add(e.category); });
    return ["all", ...Array.from(cats).sort()];
  }, [dayEvents]);

  const filteredEvents = useMemo(() => {
    if (categoryFilter === "all") return dayEvents;
    return dayEvents.filter((e) => e.category === categoryFilter);
  }, [dayEvents, categoryFilter]);

  const displayDate = selectedDay !== null ? weekDays[selectedDay] : weekDays[0];
  const { day, month, year } = formatSpanishDate(displayDate.date);

  return (
    <section className="px-4 pt-28 pb-16 md:pt-36 md:pb-24">
      <div className="max-w-7xl mx-auto">
        <InViewWrapper>
          <div className="flex items-center gap-3 mb-6">
            <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-accent font-medium">
              Vitoria-Gasteiz
            </span>
            <span className="h-px flex-1 bg-border max-w-20" aria-hidden="true" />
          </div>
        </InViewWrapper>

        <InViewWrapper>
          <div className="mb-2">
            <span className="font-display text-[4rem] md:text-[7rem] leading-none font-black text-fg tracking-[-0.03em]">
              {day}
            </span>
            <span className="font-mono text-sm md:text-base text-fg-muted block -mt-1 md:-mt-3">
              {month} {year}
            </span>
          </div>

          <h1 className="font-display text-3xl md:text-5xl font-black text-fg leading-tight mb-3 tracking-[-0.02em]">
            Gasteiz tiene plan
          </h1>

          <p className="text-base md:text-lg text-fg-muted max-w-lg mb-10 leading-relaxed">
            Conciertos, exposiciones, cine, deporte y planes familiares en Vitoria-Gasteiz.
          </p>
        </InViewWrapper>

        <InViewWrapper>
          <div
            className="flex gap-2 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4"
            role="tablist"
            aria-label="Selecciona un día"
          >
            {weekDays.map((dayItem, idx) => (
              <button
                key={dayItem.date}
                onClick={() => toggleDay(idx)}
                role="tab"
                aria-selected={selectedDay === idx}
                aria-controls={`day-panel-${idx}`}
                className={`flex-shrink-0 flex flex-col items-center gap-0.5 px-5 py-3 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer ${
                  selectedDay === idx
                    ? "bg-accent text-white"
                    : "bg-surface border border-border text-fg-muted hover:border-border-hover hover:text-fg"
                }`}
                style={{
                  borderRadius: selectedDay === idx ? '16px' : '14px',
                  boxShadow: selectedDay === idx ? '0 4px 12px rgba(201, 74, 61, 0.25)' : 'none',
                }}
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.15em]">
                  {dayItem.label}
                </span>
                <span className="font-display text-2xl font-bold leading-tight">
                  {new Date(dayItem.date).getDate()}
                </span>
                <span className={`font-mono text-[9px] uppercase tracking-wider ${
                  selectedDay === idx ? "text-white/70" : "text-fg-subtle"
                }`}>
                  {dayItem.count} ev.
                </span>
              </button>
            ))}
          </div>
        </InViewWrapper>

        {selectedDay !== null && weekDays[selectedDay] && (
          <div
            id={`day-panel-${selectedDay}`}
            role="tabpanel"
            className="mt-6 animate-fadeIn"
          >
            <div className="double-bezel-outer rounded-[1.25rem] p-1.5">
              <div className="double-bezel rounded-[calc(1.25rem-0.375rem)] p-5 md:p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-display text-lg text-fg">
                    {weekDays[selectedDay].isToday ? "Hoy" : weekDays[selectedDay].label}{" "}
                    {new Date(weekDays[selectedDay].date).getDate()} &mdash;{" "}
                    {weekDays[selectedDay].count} evento{weekDays[selectedDay].count !== 1 ? "s" : ""}
                  </h3>
                  <button
                    onClick={() => setSelectedDay(null)}
                    className="text-fg-subtle hover:text-fg-muted text-sm font-mono transition-colors duration-300 cursor-pointer"
                    aria-label="Cerrar panel"
                  >
                    Cerrar
                  </button>
                </div>

                {availableCategories.length > 1 && (
                  <div className="flex gap-1.5 mb-4 flex-wrap">
                    {availableCategories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setCategoryFilter(cat)}
                        className={`px-3 py-1 text-xs font-medium rounded-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer ${
                          categoryFilter === cat
                            ? "bg-accent text-white"
                            : "bg-bg-muted text-fg-muted hover:text-fg hover:bg-border"
                        }`}
                      >
                        {cat === "all" ? "Todos" : cat}
                      </button>
                    ))}
                  </div>
                )}

                {filteredEvents.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredEvents.map((evento) => {
                      const { day: evDay, month: evMonth } = formatDate(evento.date);
                      const catColor = CATEGORY_COLORS[evento.category || "Otros"] || "#9C9996";
                      return (
                        <a
                          key={evento.id}
                          href={evento.link || "#"}
                          target={evento.link ? "_blank" : undefined}
                          rel={evento.link ? "noopener noreferrer" : undefined}
                          className="group relative overflow-hidden block focus-visible:outline-2 focus-visible:outline-accent"
                          style={{ borderRadius: '14px' }}
                        >
                          <div className="aspect-[4/3] relative">
                            {evento.image ? (
                              <img
                                src={evento.image}
                                alt={evento.title}
                                className="absolute inset-0 w-full h-full object-cover transition-transform duration-[800ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105"
                                loading="lazy"
                              />
                            ) : (
                              <div className="absolute inset-0 w-full h-full bg-accent-subtle flex items-center justify-center">
                                <span className="font-display text-5xl text-accent/20">
                                  {evento.title.charAt(0)}
                                </span>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                            <div className="absolute top-3 left-3 bg-white/15 backdrop-blur-xl rounded-xl px-2.5 py-1.5 text-center leading-tight"
                              style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)' }}>
                              <span className="block font-mono text-[11px] uppercase text-white/70">
                                {evMonth}
                              </span>
                              <span className="block font-display text-lg text-white">
                                {evDay}
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
                              <div className="flex items-center gap-1.5 mb-1.5">
                                {evento.category && (
                                  <span
                                    className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5"
                                    style={{
                                      backgroundColor: `${catColor}CC`,
                                      color: "white",
                                      borderRadius: '3px',
                                    }}
                                  >
                                    {evento.category}
                                  </span>
                                )}
                                {evento.source && (
                                  <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-white/50">
                                    {sourceLabel(evento.source)}
                                  </span>
                                )}
                              </div>
                              <h4 className="font-display text-base font-semibold text-white leading-snug mb-1.5 line-clamp-2">
                                {evento.title}
                              </h4>
                              {evento.location && (
                                <p className="font-mono text-xs text-white/70 flex items-center gap-1.5">
                                  <span className="w-1 h-1 rounded-full bg-accent inline-block shrink-0" />
                                  {evento.location}
                                </p>
                              )}
                            </div>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-fg-subtle text-sm text-center py-4">
                    {categoryFilter !== "all"
                      ? `No hay eventos de "${categoryFilter}" para este día`
                      : "No hay eventos para este día"}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
