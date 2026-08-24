"use client";

import Link from "next/link";
import { InViewWrapper, EventCard } from "@/lib/shared";
import { CATEGORY_COLORS } from "@/lib/categories";
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
};

export default function HomeEventsClient({ eventos }: { eventos: Evento[] }) {
  return (
    <section className="py-12 md:py-16 px-5 sm:px-6 bg-bg-muted">
      <div className="max-w-7xl mx-auto">
        <InViewWrapper>
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="font-mono text-[11px] tracking-[0.2em] uppercase text-fg-subtle">
                Agenda
              </span>
              <span className="h-px flex-1 bg-border max-w-12" aria-hidden="true" />
            </div>
            <h2 className="font-display text-2xl md:text-3xl text-fg font-bold tracking-[-0.02em] leading-tight mb-2">
              Próximos eventos
            </h2>
            <p className="text-fg-muted text-sm">
              Lo que viene en Vitoria-Gasteiz
            </p>
          </div>
        </InViewWrapper>

        {eventos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {eventos.slice(0, 12).map((evento, i) => (
              <InViewWrapper key={evento.id} delay={i * 0.04}>
                <EventCard
                  evento={evento}
                  categoryColors={CATEGORY_COLORS}
                  priority={i < 4}
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

        <InViewWrapper>
          <div className="mt-10">
            <Link
              href="/culture"
              className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:text-accent-hover transition-colors duration-300 group"
            >
              Ver todos los eventos
              <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8h10M9 4l4 4-4 4" />
              </svg>
            </Link>
          </div>
        </InViewWrapper>
      </div>
    </section>
  );
}
