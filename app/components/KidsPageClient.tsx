"use client";

import Image from "next/image";
import { InViewWrapper } from "@/lib/shared";
import FavoriteButton from "./FavoriteButton";

type Evento = {
  id: string;
  title: string;
  date: string;
  image?: string;
  location?: string;
  link: string;
};

export default function KidsPageClient({ eventos }: { eventos: Evento[] }) {
  return (
    <div className="px-5 sm:px-6 max-w-7xl mx-auto pt-28 pb-32">
      <header className="mb-12">
        <p className="font-mono text-xs tracking-[0.2em] uppercase text-accent mb-3">
          Familia
        </p>
        <h1 className="font-display text-4xl md:text-5xl text-fg mb-3 tracking-[-0.02em]">
          Planes con Niños
        </h1>
        <p className="text-fg-muted max-w-2xl">
          Actividades y planes familiares en Vitoria-Gasteiz
        </p>
      </header>

      {eventos.length === 0 ? (
        <p className="text-fg-subtle text-center py-12 font-mono text-sm">
          No hay eventos disponibles
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {eventos.map((evento, index) => {
            const d = new Date(evento.date);
            const month = isNaN(d.getTime()) ? "???" : new Intl.DateTimeFormat("es", { month: "short" }).format(d).toUpperCase().replace(".", "");
            const day = isNaN(d.getTime()) ? "??" : d.getDate();
            return (
              <InViewWrapper key={evento.id} delay={Math.min(index * 0.04, 0.4)}>
                <a
                  href={evento.link || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group double-bezel-outer rounded-[1.25rem] p-1.5 block focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <div className="double-bezel rounded-[calc(1.25rem-0.375rem)] overflow-hidden">
                    <div className="aspect-[4/3] relative">
                      {evento.image ? (
                        <Image
                          src={evento.image}
                          alt={evento.title}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          className="object-cover transition-transform duration-[800ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105"
                        />
                      ) : (
                        <div className="absolute inset-0 w-full h-full bg-accent-subtle flex items-center justify-center">
                          <span className="font-display text-6xl text-accent/20">
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
      )}
    </div>
  );
}
