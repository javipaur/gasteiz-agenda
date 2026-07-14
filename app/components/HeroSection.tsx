"use client";

import { useState, useMemo, useCallback } from "react";
import FavoriteButton from "./FavoriteButton";
import {
  InViewWrapper,
  EventCard,
} from "@/lib/shared";
import { formatSpanishDate, localDateStr } from "@/lib/utils";
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
    dayEvents.forEach((e) => {
      if (e.category) cats.add(e.category);
    });
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
          <div className="mb-2 flex items-end gap-4 md:gap-6">
            <span className="font-display text-[5rem] md:text-[9rem] leading-[0.85] font-black text-fg tracking-[-0.04em] select-none">
              {day}
            </span>
            <div className="pb-2 md:pb-4">
              <span className="font-mono text-sm md:text-base text-fg-muted block">
                {month} {year}
              </span>
            </div>
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
                  borderRadius: selectedDay === idx ? "16px" : "14px",
                  boxShadow:
                    selectedDay === idx
                      ? "0 4px 12px rgba(201, 74, 61, 0.25)"
                      : "none",
                }}
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.15em]">
                  {dayItem.label}
                </span>
                <span className="font-display text-2xl font-bold leading-tight">
                  {new Date(dayItem.date).getDate()}
                </span>
                <span
                  className={`font-mono text-[9px] uppercase tracking-wider ${
                    selectedDay === idx ? "text-white/70" : "text-fg-subtle"
                  }`}
                >
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
                    {weekDays[selectedDay].isToday
                      ? "Hoy"
                      : weekDays[selectedDay].label}{" "}
                    {new Date(weekDays[selectedDay].date).getDate()} &mdash;{" "}
                    {weekDays[selectedDay].count} evento
                    {weekDays[selectedDay].count !== 1 ? "s" : ""}
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
                    {filteredEvents.map((evento) => (
                      <EventCard
                        key={evento.id}
                        evento={evento}
                        showCategory
                        showSource
                        categoryColors={CATEGORY_COLORS}
                      />
                    ))}
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
