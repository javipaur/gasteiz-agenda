"use client";

import { useRef } from "react";
import FavoriteButton from "./FavoriteButton";

interface Evento {
  id: string;
  title: string;
  date: string;
  image?: string;
  location?: string;
  link?: string;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return {
    day: d.getDate(),
    month: d.toLocaleDateString("es-ES", { month: "short" }),
  };
}

function EventCard({ evento }: { evento: Evento }) {
  const { day, month } = formatDate(evento.date);
  return (
    <a
      href={evento.link || "#"}
      target={evento.link ? "_blank" : undefined}
      rel={evento.link ? "noopener noreferrer" : undefined}
      className="min-w-[260px] md:min-w-[300px] relative overflow-hidden rounded-xl shrink-0 group/card focus-visible:outline-2 focus-visible:outline-red block"
    >
      <div className="aspect-[4/3] relative">
        {evento.image ? (
          <img
            src={evento.image}
            alt={evento.title}
            className="absolute inset-0 w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 w-full h-full bg-green/30 flex items-center justify-center">
            <span className="font-display text-5xl text-white/30">
              {evento.title.charAt(0)}
            </span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

        <div className="absolute top-3 left-3 bg-white/20 backdrop-blur-sm rounded-lg px-2.5 py-1.5 text-center leading-tight">
          <span className="block font-mono text-[11px] uppercase text-white/80">
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
              <span className="w-1 h-1 rounded-full bg-red inline-block shrink-0" />
              {evento.location}
            </p>
          )}
        </div>
      </div>
    </a>
  );
}

export default function ContinuousCarousel({
  eventos,
}: {
  eventos: Evento[];
}) {
  const ref = useRef<HTMLDivElement>(null);

  if (!eventos || eventos.length === 0) return null;

  return (
    <div
      ref={ref}
      className="overflow-hidden w-full group"
      role="list"
      aria-label="Lista de próximos eventos"
    >
      <div className="flex animate-scroll gap-4 group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]">
        {eventos.map((evento) => (
          <div key={evento.id} role="listitem">
            <EventCard evento={evento} />
          </div>
        ))}
        {eventos.map((evento) => (
          <div key={`dup-${evento.id}`} role="listitem" aria-hidden="true">
            <div tabIndex={-1}>
              <EventCard evento={evento} />
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .animate-scroll {
          animation: scroll 30s linear infinite;
        }

        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-scroll {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
