"use client";

import { useState, useMemo } from "react";
import { InViewWrapper, EventCard } from "@/lib/shared";
import { SECTION_TINT } from "@/lib/sectionTint";
import { BLANCA_COLORS, mapFiestaToCard } from "./blanca";
import { blancaEditionYear } from "@/lib/blanca";
import type { FiestaBlanca } from "@/lib/sources/fiestas-blanca";

const DAY_NAMES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function formatDateLong(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}`;
}

export default function FiestasBlancaPageClient({
  fiestas,
}: {
  fiestas: FiestaBlanca[];
}) {
  const [selectedCategory, setSelectedCategory] = useState<string>("Todas");
  const [selectedDay, setSelectedDay] = useState<string>("Todos");

  /**
   * El año y el rango salen de las fechas que hay, no de una constante. El
   * subtítulo estaba escrito con el año a mano y con las fechas a mano, así que
   * los dos se quedaban diciendo la edición anterior en cuanto esta terminaba.
   */
  const edicion = useMemo(() => {
    const dates = fiestas.map((f) => f.date).filter(Boolean).sort();
    const year = blancaEditionYear(dates);
    const rango =
      dates.length > 1
        ? `${formatDateLong(dates[0])} – ${formatDateLong(dates[dates.length - 1])}, ${year}`
        : "";
    return { year, rango };
  }, [fiestas]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    fiestas.forEach((f) => {
      if (f.category) {
        f.category.split(", ").forEach((c) => cats.add(c));
      }
    });
    return ["Todas", ...Array.from(cats).sort()];
  }, [fiestas]);

  const days = useMemo(() => {
    const d = new Set<string>();
    fiestas.forEach((f) => {
      if (f.date) d.add(f.date);
    });
    return ["Todos", ...Array.from(d).sort()];
  }, [fiestas]);

  const filtered = useMemo(() => {
    return fiestas.filter((f) => {
      if (selectedCategory !== "Todas") {
        const cats = f.category?.split(", ") || [];
        if (!cats.includes(selectedCategory)) return false;
      }
      if (selectedDay !== "Todos" && f.date !== selectedDay) return false;
      return true;
    });
  }, [fiestas, selectedCategory, selectedDay]);

  const groupedByDay = useMemo(() => {
    const map = new Map<string, FiestaBlanca[]>();
    filtered.forEach((f) => {
      const key = f.date || "sin-fecha";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    // `100dvh` y no `100vh`: en móvil, `vh` es el alto del viewport con la barra de
    // URL desplegada. Al desplazarse la barra se retira, el viewport crece y
    // underneath queda un hueco del color del fondo. `dvh` sigue a la barra. Mismo
    // motivo que `layout.tsx`, `error.tsx` y `not-found.tsx`.
    <div className="min-h-[100dvh]">
      <section className="pt-32 md:pt-36 pb-8 px-5 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <InViewWrapper>
            <div className="flex items-center gap-2 mb-3">
              <span aria-hidden="true" className={`inline-block h-5 w-[3px] rounded-full ${SECTION_TINT.fiestas.bar}`} />
              <span className={`font-display italic ${SECTION_TINT.fiestas.text} text-sm`}>La Blanca</span>
            </div>
            <h1 className="font-display text-4xl md:text-[2.75rem] text-fg font-semibold tracking-[-0.02em] leading-tight mb-4">
              Fiestas de la Virgen Blanca
            </h1>
            <p className="text-fg-muted text-lg md:text-xl leading-relaxed max-w-2xl">
              Programa completo{edicion.rango ? ` · ${edicion.rango}` : ""}
            </p>
          </InViewWrapper>
        </div>
      </section>

      <section className="px-5 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <InViewWrapper>
            <div className="py-8 border-t border-border">
              <p className="text-xs font-mono uppercase tracking-wider text-fg-subtle mb-4">Categoría</p>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    /* Los dos grupos de esta página son conmutables y su estado se
                       comunicaba solo con el color de fondo. */
                    aria-pressed={selectedCategory === cat}
                    className={`px-3.5 py-2 text-xs font-mono uppercase tracking-wider rounded-full border transition-all duration-300 ${
                      selectedCategory === cat
                        ? "bg-fg text-bg border-fg"
                        : "bg-transparent text-fg-muted border-border hover:border-fg-muted hover:text-fg"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </InViewWrapper>

          <InViewWrapper>
            <div className="py-8 border-t border-border">
              <p className="text-xs font-mono uppercase tracking-wider text-fg-subtle mb-4">Día</p>
              <div className="flex flex-wrap gap-2">
                {days.map((day) => {
                  const label =
                    day === "Todos"
                      ? "Todos"
                      : formatDateLong(day);
                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDay(day)}
                      aria-pressed={selectedDay === day}
                      className={`px-3.5 py-2 text-xs rounded-full border transition-all duration-300 ${
                        selectedDay === day
                          ? "bg-accent text-white border-accent"
                          : "bg-transparent text-fg-muted border-border hover:border-fg-muted hover:text-fg"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </InViewWrapper>
        </div>
      </section>

      <section className="px-5 sm:px-6 pt-14 pb-20 md:pb-28">
        <div className="max-w-7xl mx-auto">
          {groupedByDay.length > 0 ? (
            groupedByDay.map(([day, events]) => (
              <div key={day} className="mb-16 last:mb-0">
                <InViewWrapper>
                  <div className="mb-10">
                    <h2 className="font-display text-xl md:text-2xl text-fg font-semibold tracking-[-0.01em] mb-2">
                      {day !== "sin-fecha" ? formatDateLong(day) : "Sin fecha"}
                    </h2>
                    <span className="text-xs font-mono text-fg-subtle">
                      {events.length} {events.length === 1 ? "evento" : "eventos"}
                    </span>
                  </div>
                </InViewWrapper>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 md:gap-6">
                  {events.map((f, i) => (
                    <InViewWrapper key={f.id} delay={i * 0.03} blur>
                      <EventCard
                        evento={mapFiestaToCard(f)}
                        categoryColors={BLANCA_COLORS}
                      />
                    </InViewWrapper>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-fg-muted py-20 font-mono text-sm">
              No se encontraron eventos con los filtros seleccionados
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
