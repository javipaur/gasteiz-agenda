"use client";

import Link from "next/link";
import Image from "next/image";
import { imagenServible } from "@/lib/image-hosts";
import { InViewWrapper } from "@/lib/shared";
import { SECTION_TINT } from "@/lib/sectionTint";
import FavoriteButton from "./FavoriteButton";

type Evento = {
  id: string;
  slug: string;
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
        <div className="flex items-center gap-2 mb-3">
          <span aria-hidden="true" className={`inline-block h-5 w-[3px] rounded-full ${SECTION_TINT.kids.bar}`} />
          <span className={`font-display italic ${SECTION_TINT.kids.text} text-sm`}>Familia</span>
        </div>
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
                <div className="group relative double-bezel-outer rounded-[1.25rem] p-1.5 block transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:shadow-lg hover:shadow-accent/5 hover:-translate-y-1 focus-within:outline-2 focus-within:outline-accent">
                  {/*
                    El favorito es hermano del `<Link>`, no hijo suyo. El contenido
                    de un `a` no puede ser interactivo: dentro, el HTML es inválido
                    y el enlace se anuncia como "enlace con botón". Sigue siendo un
                    botón alcanzable con Tab y con lector.
                  */}
                  <Link
                    href={`/evento/${evento.slug}`}
                    className="block focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    <div className="double-bezel rounded-[calc(1.25rem-0.375rem)] overflow-hidden">
                      <div className="aspect-[4/3] relative">
                        {imagenServible(evento.image) ? (
                          <Image
                            src={evento.image}
                            /* `alt=""`: la imagen y el título comparten `<a>`, así
                               que con el `alt` el lector oye el título dos veces. */
                            alt=""
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-[800ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105"
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
                  </Link>

                  {/* 6 px de marco (`p-1.5`) + los 12 px de la esquina de antes. */}
                  <div className="absolute top-[1.125rem] right-[1.125rem] z-10">
                    <FavoriteButton
                      event={{
                        id: evento.id,
                        slug: evento.slug,
                        title: evento.title,
                        date: evento.date,
                        image: evento.image,
                        location: evento.location,
                        link: evento.link,
                      }}
                    />
                  </div>
                </div>
              </InViewWrapper>
            );
          })}
        </div>
      )}
    </div>
  );
}
