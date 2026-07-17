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
    .slice(0, 8);

  if (upcoming.length === 0) return null;

  return (
    <section className="py-16 md:py-24 px-4 bg-gradient-to-b from-amber-500/5 via-transparent to-transparent">
      <div className="max-w-7xl mx-auto">
        <InViewWrapper>
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl" aria-hidden="true">
                  🎉
                </span>
                <h2 className="font-display text-3xl md:text-4xl text-fg font-bold tracking-[-0.02em]">
                  La Blanca 2026
                </h2>
                <span
                  className="h-px flex-1 bg-border max-w-20 hidden sm:block"
                  aria-hidden="true"
                />
              </div>
              <p className="text-fg-muted">
                Fiestas de la Virgen Blanca · 15 jul – 10 ago
              </p>
            </div>

            <a
              href="/fiestas-blanca"
              className="hidden md:inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-amber-600 hover:text-amber-700 transition-colors duration-300"
            >
              Ver todas
              <svg
                className="w-3 h-3"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                <path d="M2.5 9.5l7-7M3.5 2.5h6v6" />
              </svg>
            </a>
          </div>
        </InViewWrapper>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
          {upcoming.map((f, i) => (
            <InViewWrapper key={f.id} delay={i * 0.04} blur>
              <EventCard
                evento={mapFiestaToCard(f)}
                categoryColors={BLANCA_COLORS}
              />
            </InViewWrapper>
          ))}
        </div>

        <InViewWrapper>
          <div className="mt-10 text-center">
            <a
              href="/fiestas-blanca"
              className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-full font-body text-sm hover:bg-amber-600 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
            >
              Ver programa completo
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M3 11l8-8M5 3h6v6" />
              </svg>
            </a>
          </div>
        </InViewWrapper>
      </div>
    </section>
  );
}
