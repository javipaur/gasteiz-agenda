"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import Image from "next/image";
import { propsImagen } from "@/lib/image-proxy";
import Link from "next/link";
import { InViewWrapper, EventCard } from "@/lib/shared";
import { localDateStr } from "@/lib/utils";
import { normalizeCategory, CATEGORY_COLORS, CATEGORY_FILLS } from "@/lib/categories";
import EmptyState from "./EmptyState";
import SectionHead from "./SectionHead";

/**
 * `AgendaEvento` menos lo que esta sección no usa. `slug` es obligatorio y no por
 * cortesía: la tarjeta de abajo enlaza con `evento.slug` y el detalle resuelve
 * contra `AgendaEvento.slug`, así que si el tipo lo admitiera sin slug el enlace
 * se construiría con un `undefined` en lugar de romperse aquí.
 */
type Evento = {
  id: string;
  slug: string;
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

export default function NextDaysSection({
  eventos,
  ahora,
}: {
  eventos: Evento[];
  /**
   * El instante contra el que se construye la semana, en ms.
   *
   * Estaba dentro del `useMemo` con deps `[eventos]`, que es un memo impuro: la
   * franja "Hoy–Domingo" se calculaba una vez y se quedaba congelada aunque la
   * pestaña pasara la medianoche. El reloj llega como prop —igual que en
   * `HeroSection` y en `app/culture/page.tsx`— para que el memo sea puro y sus
   * deps no_INCLUDEAN el tiempo.
   */
  ahora: number;
}) {
  const [selectedDay, setSelectedDay] = useState<number | null>(0);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const weekDays: DayGroup[] = useMemo(() => {
    const today = new Date(ahora);
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
  }, [eventos, ahora]);

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

  /* `propsImagen` y no `e.image`: el destacado se elige entre los eventos que
     traen imagen, y "traer imagen" no es lo mismo que "poder mostrarla". Con un host
     fuera de `remotePatterns`, `next/image` lanza en render —no en el `onError`— y
     tumbaba la home entera con un HTTP 200. Ver `lib/image-hosts.ts`.
     Se guarda el resultado entero y no un booleano porque es lo que va al `<Image>`:
     el destacado es la imagen más grande de la home, y por lo mismo que en las tarjetas
     tiene que saber si va por el proxy. */
  const featured = useMemo(
    () => dayEvents.find((e) => propsImagen(e.image)) || null,
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
    <section className="px-5 sm:px-6 py-8 md:py-14 max-w-5xl mx-auto">
      <InViewWrapper>
        <SectionHead
          tag="Esta semana"
          title="Próximos 7 días"
          subtitle="Planes confirmados en los próximos días en Vitoria-Gasteiz."
          color="var(--teal)"
        />
      </InViewWrapper>

      <InViewWrapper>
        <div className="flex items-center gap-2 mb-4">
          {!todaySelected && (
            <button
              onClick={() => { setSelectedDay(0); setCategoryFilter("all"); }}
              // `min-h-[44px]` en lugar de `h-9`: eran 36 px de alto. La fila de
              // pestañas es la forma principal de elegir día, y 36 es justo lo
              // que hace fallar un dedo gordo.
              className="min-h-[44px] px-4 rounded-full bg-bg-muted border border-border text-sm font-semibold text-fg-muted hover:text-fg hover:border-border-hover transition-all duration-300 cursor-pointer active:scale-[0.97]"
            >
              Hoy
            </button>
          )}
          {hasWeekend && !weekendSelected && (
            <button
              onClick={() => { setSelectedDay(weekendIdx); setCategoryFilter("all"); }}
              className="group inline-flex items-center gap-2 min-h-[44px] px-4 rounded-full bg-bg-muted border border-border text-sm font-semibold text-fg-muted hover:text-fg hover:border-border-hover transition-all duration-300 cursor-pointer active:scale-[0.97]"
            >
              Este finde
              <span aria-hidden="true" className="text-xs transition-transform duration-300 group-hover:translate-x-0.5">→</span>
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
                className={`flex-shrink-0 inline-flex items-center gap-2 min-h-[44px] px-4 rounded-full cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97] ${
                  isSelected
                    ? "bg-fg text-bg"
                    : "bg-bg-muted border border-border text-fg-muted hover:text-fg hover:border-border-hover"
                }`}
              >
                <span className="text-sm font-semibold">{dayName}</span>
                <span className={`text-sm font-semibold tabular-nums ${isSelected ? "text-bg/70" : "text-fg-subtle"}`}>
                  {dayNum}
                </span>
                {dayItem.isToday && (
                  <span
                    className={`size-1.5 rounded-full ${isSelected ? "bg-green" : "bg-teal"}`}
                    aria-hidden="true"
                  />
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
                // Sin relleno ni tamaño declarados medía 20×20. El `-my-2` compensa
                // los 12 px de alto que añaden los 44 para que la fila no crezca:
                // el área sensible sigue siendo de 44 y lo que se ve, el texto, se
                // queda donde estaba.
                className="min-w-[44px] min-h-[44px] px-2 -my-2 text-fg-subtle hover:text-fg-muted text-sm font-mono transition-colors duration-300 cursor-pointer"
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
                    className={`min-w-[44px] min-h-[44px] px-3 font-medium rounded-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer ${
                      categoryFilter === cat
                        ? `${cat !== "all" && CATEGORY_FILLS[cat] ? "" : "bg-accent "}text-white`
                        : "bg-bg-muted text-fg-muted hover:text-fg hover:bg-border"
                    }`}
                    style={
                      categoryFilter === cat && cat !== "all" && CATEGORY_FILLS[cat]
                        ? { backgroundColor: CATEGORY_FILLS[cat] }
                        : undefined
                    }
                  >
                    {cat === "all" ? "Todos" : cat}
                  </button>
                ))}
              </div>
            )}

            {featured && (
              <Link
                href={`/evento/${featured.slug}`}
                className="group relative block overflow-hidden rounded-2xl bg-bg-muted mb-5 cursor-pointer active:scale-[0.99]"
              >
                <div className="relative aspect-[16/7] md:aspect-[2.4/1]">
                  <Image
                    {...propsImagen(featured.image)!}
                    /* `alt=""`: la imagen y el título comparten el `<a>` del destacado, así que con el
                       `alt` puesto el lector anunciaba el evento dos veces. */
                    alt=""
                    fill
                    sizes="(max-width: 1024px) 90vw, 960px"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-[800ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" aria-hidden="true" />
                  <span className="absolute top-3 left-3 inline-flex items-center gap-2">
                    <span aria-hidden="true" className="inline-block h-4 w-[3px] rounded-full bg-accent" />
                    <span className="font-display italic text-white text-base drop-shadow">
                      {weekDays[selectedDay]?.isToday ? "Destacado hoy" : "Destacado"}
                    </span>
                  </span>
                  <div className="absolute bottom-0 left-0 right-0 p-5 md:p-6">
                    <p className="text-sm text-white/80 mb-1">
                      {featured.location || "Vitoria-Gasteiz"}
                    </p>
                    <h4 className="font-display text-xl md:text-2xl text-white font-semibold leading-snug tracking-[-0.02em] line-clamp-2">
                      {featured.title}
                    </h4>
                  </div>
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
                    title="Sin planes para este día"
                    hint="Perfecto para pasear por el Casco Viejo o mirar lo que llega el resto de la semana."
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}