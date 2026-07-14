"use client";

import { InViewWrapper, EventCard } from "@/lib/shared";
import { CATEGORY_COLORS } from "@/lib/categories";

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
    <section className="py-16 md:py-24 px-4 bg-bg-muted">
      <div className="max-w-7xl mx-auto">
        <InViewWrapper>
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="font-display text-3xl md:text-4xl text-fg font-bold tracking-[-0.02em]">
                  Próximos eventos
                </h2>
                <span className="h-px flex-1 bg-border max-w-20 hidden sm:block" aria-hidden="true" />
              </div>
              <p className="text-fg-muted">
                Planes, cultura y deporte cerca de ti
              </p>
            </div>

            <a
              href="/culture"
              className="hidden md:inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-accent hover:text-accent-hover transition-colors duration-300"
            >
              Ver todos
              <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2.5 9.5l7-7M3.5 2.5h6v6" />
              </svg>
            </a>
          </div>
        </InViewWrapper>

        {eventos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
            {eventos.slice(0, 12).map((evento, i) => (
              <InViewWrapper key={evento.id} delay={i * 0.04} blur>
                <EventCard
                  evento={evento}
                  categoryColors={CATEGORY_COLORS}
                />
              </InViewWrapper>
            ))}
          </div>
        ) : (
          <p className="text-center text-fg-muted py-12 font-mono text-sm">
            No hay eventos disponibles
          </p>
        )}

        <InViewWrapper>
          <div className="mt-10 text-center">
            <a
              href="/culture"
              className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-full font-body text-sm hover:bg-accent-hover transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
            >
              Ver todos los eventos
              <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 11l8-8M5 3h6v6" />
              </svg>
            </a>
          </div>
        </InViewWrapper>
      </div>
    </section>
  );
}
