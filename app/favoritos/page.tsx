"use client";

import { useFavorites } from "@/app/context/FavoritesContext";
import { EventCard } from "@/lib/shared";
import PushNotifications from "@/app/components/PushNotifications";
import Link from "next/link";

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21.5l-1.5-1.3C4.5 16 2 13.3 2 10c0-3 2.3-5.5 5-5.5 1.6 0 3 .8 4 2 1-1.2 2.4-2 4-2 2.7 0 5 2.5 5 5.5 0 3.3-2.5 6-8.5 10.2L12 21.5z" />
    </svg>
  );
}

export default function FavoritosPage() {
  const { favorites, count } = useFavorites();

  const sorted = [...favorites].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="px-5 sm:px-6 max-w-7xl mx-auto pt-28 pb-32">
      <header className="mb-12">
        <p className="font-mono text-xs tracking-[0.2em] uppercase text-accent mb-3">
          Favoritos
        </p>
        <h1 className="font-display text-4xl md:text-5xl text-fg mb-3 tracking-[-0.02em]">
          Tus eventos guardados
        </h1>
        <p className="text-fg-muted max-w-2xl">
          {count > 0
            ? `Tienes ${count} ${count === 1 ? "evento guardado" : "eventos guardados"}`
            : "Aún no has guardado ningún evento. Explora la agenda y toca el corazón en cualquier evento."}
        </p>
      </header>

      {count === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center rounded-2xl border border-dashed border-border bg-surface/60">
          <div className="w-16 h-16 rounded-full bg-bg-muted text-fg-subtle flex items-center justify-center mb-6">
            <HeartIcon className="w-8 h-8" />
          </div>
          <p className="font-display text-xl text-fg-muted mb-6">
            No hay favoritos todavía
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-full text-sm font-medium hover:bg-accent-hover transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
          >
            Ver eventos
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 7h8M7 3l4 4-4 4" />
            </svg>
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {sorted.map((evento) => (
              <EventCard key={evento.id} evento={evento} />
            ))}
          </div>
          <PushNotifications />
        </>
      )}
    </div>
  );
}
