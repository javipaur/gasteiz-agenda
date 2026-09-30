"use client";

import { InViewWrapper, EventCard } from "@/lib/shared";
import { CATEGORY_COLORS } from "@/lib/categories";
import SectionHead from "./SectionHead";
import EmptyState from "./EmptyState";

/**
 * `AgendaEvento` menos lo que esta sección no usa. `slug` es obligatorio porque
 * `EventCard` lo exige: la tarjeta enlaza con `evento.slug` y el detalle resuelve
 * contra `AgendaEvento.slug`.
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
};

export default function HomeEventsClient({ eventos }: { eventos: Evento[] }) {
  return (
    <section className="py-12 md:py-16 px-5 sm:px-6 bg-bg-muted">
      <div className="max-w-7xl mx-auto">
        <InViewWrapper>
          <SectionHead
            tag="Agenda"
            title="Próximos eventos"
            subtitle="Lo que viene en Vitoria-Gasteiz"
            href="/culture"
            linkLabel="Ver todos los eventos"
            color="var(--violet)"
          />
        </InViewWrapper>

        {eventos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {eventos.slice(0, 12).map((evento, i) => (
              <InViewWrapper
                key={evento.id}
                delay={i * 0.04}
                className={i === 0 && eventos.length >= 4 ? "sm:col-span-2 xl:col-span-2" : undefined}
              >
                <EventCard
                  evento={evento}
                  categoryColors={CATEGORY_COLORS}
                  priority={i < 4}
                  size={i === 0 && eventos.length >= 4 ? "large" : "normal"}
                />
              </InViewWrapper>
            ))}
          </div>
        ) : (
          <InViewWrapper>
            <EmptyState
              icon={
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <rect x="2.5" y="4" width="15" height="13" rx="2" />
                  <path d="M2.5 8h15M6.5 2.5V5M13.5 2.5V5" />
                </svg>
              }
              title="La agenda está en blanco"
              hint="No hay eventos publicados para los próximos días. Suele llenarse a principio de semana."
              action={{ href: "/culture", label: "Explorar la agenda cultural" }}
            />
          </InViewWrapper>
        )}
      </div>
    </section>
  );
}
