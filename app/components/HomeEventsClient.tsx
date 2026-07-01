"use client";

import { useRef, useEffect, useState } from "react";
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
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const months = [
    "ENE", "FEB", "MAR", "ABR", "MAY", "JUN",
    "JUL", "AGO", "SEP", "OCT", "NOV", "DIC",
  ];
  return {
    day: isNaN(d.getTime()) ? "??" : String(d.getDate()).padStart(2, "0"),
    month: isNaN(d.getTime()) ? "???" : months[d.getMonth()],
  };
}

function InViewWrapper({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.05 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) blur(0)' : 'translateY(32px) blur(4px)',
        transition: `all 0.9s cubic-bezier(0.32, 0.72, 0, 1) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

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
            {eventos.slice(0, 12).map((evento, i) => {
              const { day, month } = formatDate(evento.date);
              return (
                <InViewWrapper key={evento.id} delay={i * 0.04}>
                  <a
                    href={evento.link || "#"}
                    target={evento.link ? "_blank" : undefined}
                    rel={evento.link ? "noopener noreferrer" : undefined}
                    className="group double-bezel-outer rounded-[1.25rem] p-1.5 block focus-visible:outline-2 focus-visible:outline-accent transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]"
                  >
                    <div className="double-bezel rounded-[calc(1.25rem-0.375rem)] overflow-hidden">
                      <div className="aspect-[4/3] relative">
                        {evento.image ? (
                          <img
                            src={evento.image}
                            alt={evento.title}
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-[800ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <div className="absolute inset-0 w-full h-full bg-accent-subtle flex items-center justify-center">
                            <span className="font-display text-5xl text-accent/20">
                              {evento.title.charAt(0)}
                            </span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                        <div className="absolute top-3 left-3 bg-white/15 backdrop-blur-xl rounded-xl px-2.5 py-1.5 text-center leading-tight"
                          style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)' }}>
                          <span className="block font-mono text-[11px] uppercase text-white/70">
                            {month}
                          </span>
                          <span className="block font-display text-lg text-white">
                            {day}
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

                        <div className="absolute bottom-0 left-0 right-0 p-4">
                          <h3 className="font-display text-base font-semibold text-white leading-snug mb-1.5 line-clamp-2">
                            {evento.title}
                          </h3>
                          {evento.location && (
                            <p className="font-mono text-xs text-white/70 flex items-center gap-1.5">
                              <span className="w-1 h-1 rounded-full bg-accent inline-block shrink-0" />
                              {evento.location}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </a>
                </InViewWrapper>
              );
            })}
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
