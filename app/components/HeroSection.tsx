"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { InViewWrapper, EventCard } from "@/lib/shared";
import { formatSpanishDate, localDateStr } from "@/lib/utils";
import { normalizeCategory, CATEGORY_COLORS } from "@/lib/categories";
import { eventSlug } from "@/lib/slug";
import EmptyState from "./EmptyState";

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

  const dayRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const onDayTabsKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      setSelectedDay((prev) => {
        const next = prev === null ? (dir > 0 ? 0 : 6) : (prev + dir + 7) % 7;
        requestAnimationFrame(() => dayRefs.current[next]?.focus());
        return next;
      });
      setCategoryFilter("all");
    },
    []
  );

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

  const featured = useMemo(
    () => dayEvents.find((e) => e.image && e.image.length > 0) || null,
    [dayEvents]
  );

  const weekendIdx = weekDays.findIndex((d, i) => {
    const wd = new Date(d.date).getDay();
    return i > 0 ? wd === 5 || wd === 6 : wd === 6 || wd === 0;
  });
  const hasWeekend = weekendIdx > 0;
  const todaySelected = selectedDay === 0;
  const weekendSelected = selectedDay === weekendIdx;

  return (
    <section className="relative px-5 sm:px-6 pt-28 pb-12 md:pt-28 md:pb-16">
      <div className="hero-wash" aria-hidden="true" />
      <div className="max-w-7xl mx-auto">
        <InViewWrapper eager>
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

        <InViewWrapper eager>
          <h1 className="font-display text-[clamp(2.75rem,8vw,4.75rem)] font-black text-fg leading-[1.02] tracking-[-0.03em] mb-5 max-w-3xl">
            Qué hacer en
            <br />
            <span className="relative inline-block text-accent">
              Vitoria-Gasteiz
              <svg
                aria-hidden="true"
                className="absolute left-0 -bottom-[0.08em] w-full h-[0.16em]"
                viewBox="0 0 200 20"
                preserveAspectRatio="none"
                fill="none"
              >
                <path
                  d="M4 13 C 40 5, 78 17, 112 11 S 178 6, 196 12"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeLinecap="round"
                  className="squiggle-path"
                />
              </svg>
            </span>
          </h1>

          <p className="text-base md:text-lg text-fg-muted max-w-md leading-relaxed mb-10">
            {totalThisWeek > 0
              ? `${totalThisWeek} eventos esta semana. Cultura, deporte, cine y planes para todos.`
              : "Conciertos, exposiciones, cine, deporte y planes familiares."}
          </p>
        </InViewWrapper>

        <InViewWrapper eager>
          <div className="flex items-center gap-2 mb-4">
            {!todaySelected && (
              <button
                onClick={() => { setSelectedDay(0); setCategoryFilter("all"); }}
                className="px-3.5 py-1.5 rounded-full border border-border bg-surface font-mono text-[11px] uppercase tracking-[0.12em] text-fg-muted hover:text-accent hover:border-accent/40 transition-all duration-300 cursor-pointer active:scale-[0.97]"
              >
                Hoy
              </button>
            )}
            {hasWeekend && !weekendSelected && (
              <button
                onClick={() => { setSelectedDay(weekendIdx); setCategoryFilter("all"); }}
                className="group inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-border bg-surface font-mono text-[11px] uppercase tracking-[0.12em] text-fg-muted hover:text-accent hover:border-accent/40 transition-all duration-300 cursor-pointer active:scale-[0.97]"
              >
                Este finde
                <span aria-hidden="true" className="text-[10px] transition-transform duration-300 group-hover:translate-x-0.5">→</span>
              </button>
            )}
          </div>
          <div
            className="flex gap-2 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1"
            role="tablist"
            aria-label="Selecciona un día"
            onKeyDown={onDayTabsKeyDown}
          >
            {weekDays.map((dayItem, idx) => {
              const isSelected = selectedDay === idx;
              const dateObj = new Date(dayItem.date);
              const dayNum = dateObj.getDate();
              const dayName = dayItem.isToday ? "Hoy" : ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"][dateObj.getDay()];

              return (
                <button
                  key={dayItem.date}
                  ref={(el) => { dayRefs.current[idx] = el; }}
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
            key={selectedDay}
            id={`day-panel-${selectedDay}`}
            role="tabpanel"
            className="mt-8 panel-in"
          >
            <div className="rounded-2xl border border-border bg-surface p-5 md:p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-display text-lg text-fg">
                  {weekDays[selectedDay].isToday
                    ? "Hoy"
                    : weekDays[selectedDay].label}{" "}
                  {new Date(weekDays[selectedDay].date).getDate()} ·{" "}
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

              {featured && (
                <Link
                  href={`/evento/${eventSlug(featured)}`}
                  className="group relative hidden md:flex overflow-hidden rounded-2xl border border-border bg-bg-muted mb-5 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-accent/40 cursor-pointer active:scale-[0.99]"
                >
                  <div className="relative w-[46%] shrink-0 overflow-hidden bg-accent-subtle">
                    <Image
                      src={featured.image!}
                      alt={featured.title}
                      fill
                      sizes="(max-width: 1280px) 40vw, 480px"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-[800ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center gap-2 p-6">
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">
                      {weekDays[selectedDay]?.isToday ? "Destacado hoy" : "Destacado"}
                    </p>
                    <h4 className="font-display text-xl md:text-2xl text-fg font-bold leading-snug tracking-[-0.02em] line-clamp-2">
                      {featured.title}
                    </h4>
                    <p className="font-mono text-xs text-fg-muted uppercase tracking-[0.1em]">
                      {featured.location || "Vitoria-Gasteiz"}
                    </p>
                  </div>
                </Link>
              )}

              {filteredEvents.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredEvents.map((evento, i) => (
                    <EventCard
                      key={evento.id}
                      evento={evento}
                      showCategory
                      showSource
                      categoryColors={CATEGORY_COLORS}
                      priority={i < 3}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-2">
                  {categoryFilter !== "all" ? (
                    <div className="flex flex-col items-center gap-3 text-center">
                      <p className="text-fg-muted text-sm">
                        No hay eventos de <span className="text-fg font-medium">{categoryFilter}</span> para este día.
                      </p>
                      <button
                        onClick={() => setCategoryFilter("all")}
                        className="text-sm font-medium text-accent hover:text-accent-hover transition-colors duration-300 cursor-pointer"
                      >
                        Ver todas las categorías
                      </button>
                    </div>
                  ) : (
                    <EmptyState
                      icon={
                        <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="10" cy="10" r="7.5" />
                          <path d="M10 6v4l2.5 1.5" />
                        </svg>
                      }
                      title="Día sin planes publicados"
                      hint="Perfecto para pasear por el Casco Viejo o mirar lo que llega el resto de la semana."
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
