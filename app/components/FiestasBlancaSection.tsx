"use client";

import { InViewWrapper, EventCard } from "@/lib/shared";
import { CATEGORY_COLORS } from "@/lib/categories";
import { agendaSlug } from "@/lib/slug";
import type { FiestaBlanca } from "@/lib/sources/fiestas-blanca";
import SectionHead from "./SectionHead";

const BLANCA_COLORS: Record<string, string> = {
  ...CATEGORY_COLORS,
  "Conciertos La Blanca": "#C94A3D",
  "Niños en La Blanca": "#4A9C8C",
  "Blusas y Neskak": "#0166bf",
  "Cofradía de la Virgen Blanca": "#7a12e2",
  "Deporte en La Blanca": "#7CB342",
};

/**
 * La Blanca todavía no pasa por el agregado: estas props son `FiestaBlanca` tal
 * como las devuelve el scraper, no `AgendaEvento`. Es una de las dos excepciones
 * a la regla de ESLint que prohíbe importar `eventSlug`.
 *
 * El slug sale de `agendaSlug`, que es la misma normalización que aplica
 * `normalizeRaw` en `lib/agenda.ts` —incluido el `trim` del título y el descarte
 * del `"#"`—, y también la que usa `app/fiestas-blanca/page.tsx` para su
 * JSON-LD. La tarjeta y el JSON-LD de la misma página no pueden salir con slugs
 * distintos porque ya no normalizan por su cuenta. El día que La Blanca venga del
 * agregador, `mapFiestaToCard` desaparece entero.
 */
function mapFiestaToCard(f: FiestaBlanca) {
  return {
    id: f.id,
    slug: agendaSlug(f),
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
          <SectionHead
            tag="Fiestas"
            title={`La Blanca ${year}`}
            subtitle={range ? `${range} · Programación completa` : "Programación completa"}
            href="/fiestas-blanca"
            linkLabel="Ver programa completo"
            color="var(--hot)"
          />
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
      </div>
    </section>
  );
}
