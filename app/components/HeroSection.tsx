"use client";

import { useState, useMemo, useCallback } from "react";
import { InViewWrapper, EventCard } from "@/lib/shared";
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
      const daysOfShort = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];
      groups.push({
        date: dateStr,
        label: i === 0 ? "Hoy" : daysOfWeek[date.getDay()],
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
  const { month, year } = formatSpanishDate(displayDate.date);
  const totalThisWeek = weekDays.reduce((s, d) => s + d.count, 0);

  return (
    <section className="px-5 sm:px-6 pt-28 pb-12 md:pt-36 md:pb-16">
      <div className="max-w-7xl mx-auto">
        <InViewWrapper>
          <div className="flex items-center gap-3 mb-8">
            <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-fg-subtle">
              Vitoria-Gasteiz
            </span>
            <span className="h-px flex-1 bg-border max-w-12" aria-hidden="true" />
            <span className="font-mono text-[11px] tracking-[0.15em] uppercase text-fg-subtle">
              {month} {year}
            </span>
          </div>
        </InViewWrapper>

        <InViewWrapper>
          <h1 className="font-display text-[2.5rem] sm:text-[3.25rem] md:text-[4rem] font-black text-fg leading-[1.05] tracking-[-0.03em] mb-4 max-w-2xl">
            Qué hacer en
            <br />
            <span className="text-accent">Vitoria</span>
          </h1>

          <p className="text-base md:text-lg text-fg-muted max-w-md leading-relaxed mb-10">
            {totalThisWeek > 0
              ? `${totalThisWeek} eventos esta semana. Cultura, deporte, cine y planes para todos.`
              : "Conciertos, exposiciones, cine, deporte y planes familiares."}
          </p>
        </InViewWrapper>

        <InViewWrapper>
          <div
            className="flex gap-2 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1"
            role="tablist"
            aria-label="Selecciona un día"
          >
            {weekDays.map((dayItem, idx) => {
              const isSelected = selectedDay === idx;
              const dateObj = new Date(dayItem.date);
              const dayNum = dateObj.getDate();
              const dayName = dayItem.isToday ? "Hoy" : ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"][dateObj.getDay()];

              return (
                <button
                  key={dayItem.date}
                  onClick={() => toggleDay(idx)}
                  role="tab"
                  aria-selected={isSelected}
                  aria-controls={`day-panel-${idx}`}
                  className="flex-shrink-0 flex flex-col items-center gap-1 cursor-pointer group transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
                >
                  <span className={`font-mono text-[10px] uppercase tracking-[0.12em] transition-colors duration-300 ${isSelected ? "text-accent" : "text-fg-subtle group-hover:text-fg-muted"}`}>
                    {dayName}
                  </span>
                  <span
                    className={`w-12 h-12 rounded-full flex items-center justify-center font-display text-lg font-bold transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                      isSelected
                        ? "bg-accent text-white shadow-lg shadow-accent/20"
                        : "bg-surface border border-border text-fg group-hover:border-accent/30 group-hover:text-accent"
                    }`}
                  >
                    {dayNum}
                  </span>
                  {dayItem.count > 0 && (
                    <span className={`font-mono text-[9px] tabular-nums ${isSelected ? "text-accent" : "text-fg-subtle"}`}>
                      {dayItem.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </InViewWrapper>

        {selectedDay !== null && weekDays[selectedDay] && (
          <div
            id={`day-panel-${selectedDay}`}
            role="tabpanel"
            className="mt-8 animate-fadeIn"
          >
            <div className="rounded-2xl border border-border bg-surface p-5 md:p-6">
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
        )}
      </div>
    </section>
  );
}
