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
    <section className="py-16 md:py-24 px-5 sm:px-6 bg-bg-muted">
      <div className="max-w-7xl mx-auto">
        <InViewWrapper>
          <div className="mb-12">
            <h2 className="font-display text-3xl md:text-4xl text-fg font-bold tracking-[-0.02em] leading-tight mb-3">
              Próximos eventos
            </h2>
            <p className="text-fg-muted text-base">
              Planes, cultura y deporte cerca de ti
            </p>
          </div>
        </InViewWrapper>

        {eventos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-7">
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
          <div className="mt-14 text-center">
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
