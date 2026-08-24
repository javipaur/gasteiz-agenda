"use client";

import { InViewWrapper, EventCard } from "@/lib/shared";
import { CATEGORY_COLORS } from "@/lib/categories";
import type { FiestaBlanca } from "@/lib/sources/fiestas-blanca";

const BLANCA_COLORS: Record<string, string> = {
  ...CATEGORY_COLORS,
  "Conciertos La Blanca": "#C94A3D",
  "Niños en La Blanca": "#4A9C8C",
  "Blusas y Neskak": "#0166bf",
  "Cofradía de la Virgen Blanca": "#7a12e2",
  "Deporte en La Blanca": "#7CB342",
};

function mapFiestaToCard(f: FiestaBlanca) {
  return {
    id: f.id,
    title: f.title,
    date: f.date,
    image: f.image || undefined,
    location: f.location || undefined,
    link: f.url || undefined,
    category: f.category || "Fiestas",
    source: "La Blanca 2026",
    time: f.timeStart || undefined,
  };
}

export default function FiestasBlancaSection({
  fiestas,
}: {
  fiestas: FiestaBlanca[];
}) {
  if (fiestas.length === 0) return null;

  const upcoming = fiestas
    .filter((f) => f.date >= new Date().toISOString().slice(0, 10))
    .slice(0, 12);

  if (upcoming.length === 0) return null;

  const dates = fiestas.map((f) => f.date).filter(Boolean).sort();
  const fmt = (s: string) =>
    new Date(`${s}T00:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  const range =
    dates.length > 1 ? `${fmt(dates[0])} – ${fmt(dates[dates.length - 1])}` : "";
  const year = dates.length ? new Date(`${dates[0]}T00:00:00`).getFullYear() : new Date().getFullYear();

  return (
    <section className="py-16 md:py-20 px-5 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <InViewWrapper>
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-amber-600 font-medium">
                Fiestas
              </span>
              <span className="h-px flex-1 bg-amber-200 max-w-16" aria-hidden="true" />
            </div>
            <h2 className="font-display text-3xl md:text-[2.5rem] text-fg font-bold tracking-[-0.02em] leading-tight mb-2">
              La Blanca {year}
            </h2>
            <p className="text-fg-muted text-base">
              {range && `${range} · `}Programación completa
            </p>
          </div>
        </InViewWrapper>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {upcoming.map((f, i) => (
            <InViewWrapper key={f.id} delay={i * 0.04}>
              <EventCard
                evento={mapFiestaToCard(f)}
                categoryColors={BLANCA_COLORS}
              />
            </InViewWrapper>
          ))}
        </div>

        <InViewWrapper>
          <div className="mt-10">
            <a
              href="/fiestas-blanca"
              className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:text-accent-hover transition-colors duration-300 group"
            >
              Ver programa completo
              <svg
                className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </a>
          </div>
        </InViewWrapper>
      </div>
    </section>
  );
}
