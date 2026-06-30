"use client";

import { useState, useMemo, useCallback } from "react";
import FavoriteButton from "./FavoriteButton";

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

const CATEGORY_COLORS: Record<string, string> = {
  Música: "#D94A3D",
  Teatro: "#A67C52",
  Cine: "#4A7C9C",
  Exposiciones: "#2B6B4A",
  Infantil: "#4A9C8C",
  Deporte: "#7CB342",
  Danza: "#C97B8C",
  Festival: "#A67C52",
  Conferencias: "#8C6B9C",
  Fiestas: "#D94A3D",
  Visitas: "#2B6B4A",
  Otros: "#9C9C9C",
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
    case "rula":
      return "Rula";
    case "gasteizhoy":
      return "Gasteiz Hoy";
    case "fever":
      return "Fever";
    case "vam":
      return "VAM";
    case "euskadi":
      return "Euskadi";
    default:
      return source || "";
  }
}

export default function HeroSection({ eventos }: { eventos: Evento[] }) {
  const [selectedDay, setSelectedDay] = useState<number | null>(0);

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
      if (found) {
        found.events.push(ev);
      }
    }

    for (const g of groups) {
      g.count = g.events.length;
    }

    return groups;
  }, [eventos]);

  const toggleDay = useCallback((idx: number) => {
    setSelectedDay((prev) => (prev === idx ? null : idx));
  }, []);

  const displayDate =
    selectedDay !== null ? weekDays[selectedDay] : weekDays[0];
  const { day, month, year } = formatSpanishDate(displayDate.date);

  return (
    <section className="px-6 pt-12 pb-20 md:pt-20 md:pb-32">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <span className="font-mono text-xs tracking-widest uppercase text-red">
            Vitoria-Gasteiz
          </span>
          <span className="h-px flex-1 bg-stone max-w-20" aria-hidden="true" />
        </div>

        <div className="mb-2">
          <span className="font-display text-[4.5rem] md:text-[8rem] leading-none font-black text-ink tracking-tight">
            {day}
          </span>
          <span className="font-mono text-sm md:text-base text-ink-light block -mt-1 md:-mt-3">
            {month} {year}
          </span>
        </div>

        <h1 className="font-display text-4xl md:text-6xl font-black text-ink leading-tight mb-3">
          Gasteiz tiene plan
        </h1>

        <p className="text-base md:text-lg text-ink-light max-w-lg mb-10">
          Conciertos, exposiciones, cine, deporte y planes familiares en
          Vitoria-Gasteiz.
        </p>

        <div
          className="flex gap-2 overflow-x-auto pb-2 scrollbar-none"
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
              className={`flex-shrink-0 flex flex-col items-center gap-0.5 px-5 py-3 rounded-xl transition-all duration-200 cursor-pointer ${
                selectedDay === idx
                  ? "bg-red text-white shadow-md"
                  : "border border-stone text-ink-light hover:border-ink hover:text-ink bg-white/60"
              }`}
            >
              <span className="font-mono text-[10px] uppercase tracking-widest">
                {dayItem.label}
              </span>
              <span className="font-display text-2xl font-bold leading-tight">
                {new Date(dayItem.date).getDate()}
              </span>
              <span
                className={`font-mono text-[9px] uppercase tracking-wider ${
                  selectedDay === idx ? "text-white/70" : "text-ink-lighter"
                }`}
              >
                {dayItem.count} ev.
              </span>
            </button>
          ))}
        </div>

        {selectedDay !== null && weekDays[selectedDay] && (
          <div
            id={`day-panel-${selectedDay}`}
            role="tabpanel"
            className="mt-6 animate-fadeIn"
          >
            <div className="border border-stone rounded-2xl p-5 md:p-6 bg-white">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-lg text-ink">
                  {weekDays[selectedDay].isToday ? "Hoy" : weekDays[selectedDay].label}{" "}
                  {new Date(weekDays[selectedDay].date).getDate()} &mdash;{" "}
                  {weekDays[selectedDay].count} evento
                  {weekDays[selectedDay].count !== 1 ? "s" : ""}
                </h3>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="text-ink-lighter hover:text-ink-light text-sm font-mono transition-colors cursor-pointer"
                  aria-label="Cerrar panel"
                >
                  Cerrar
                </button>
              </div>

              {weekDays[selectedDay].count > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {weekDays[selectedDay].events.map((evento) => {
                    const { day: evDay, month: evMonth } = formatDate(
                      evento.date
                    );
                    const catColor =
                      CATEGORY_COLORS[evento.category || "Otros"] ||
                      "#9C9C9C";
                    return (
                      <a
                        key={evento.id}
                        href={evento.link || "#"}
                        target={evento.link ? "_blank" : undefined}
                        rel={evento.link ? "noopener noreferrer" : undefined}
                        className="group relative overflow-hidden rounded-xl border border-stone block focus-visible:outline-2 focus-visible:outline-red shadow-sm hover:shadow-md transition-shadow"
                      >
                        <div className="aspect-[4/3] relative">
                          {evento.image ? (
                            <img
                              src={evento.image}
                              alt={evento.title}
                              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              loading="lazy"
                            />
                          ) : (
                            <div className="absolute inset-0 w-full h-full bg-green/30 flex items-center justify-center">
                              <span className="font-display text-5xl text-white/30">
                                {evento.title.charAt(0)}
                              </span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                          <div className="absolute top-3 left-3 bg-white/20 backdrop-blur-sm rounded-lg px-2.5 py-1.5 text-center leading-tight shadow-sm">
                            <span className="block font-mono text-[11px] uppercase text-white/80">
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

                          {evento.time && (
                            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1">
                              <span className="font-mono text-[11px] text-white/90">
                                {evento.time}
                              </span>
                            </div>
                          )}

                          <div className="absolute bottom-0 left-0 right-0 p-4">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              {evento.category && (
                                <span
                                  className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm"
                                  style={{
                                    backgroundColor: `${catColor}CC`,
                                    color: "white",
                                  }}
                                >
                                  {evento.category}
                                </span>
                              )}
                              {evento.source && (
                                <span className="font-mono text-[9px] uppercase tracking-widest text-white/50">
                                  {sourceLabel(evento.source)}
                                </span>
                              )}
                            </div>
                            <h4 className="font-display text-base font-semibold text-white leading-snug mb-1.5 line-clamp-2 drop-shadow-sm">
                              {evento.title}
                            </h4>
                            {evento.location && (
                              <p className="font-mono text-xs text-white/70 flex items-center gap-1.5 drop-shadow-sm">
                                <span className="w-1 h-1 rounded-full bg-red inline-block shrink-0" />
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
                <p className="text-ink-lighter text-sm text-center py-4">
                  No hay eventos para este día
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
