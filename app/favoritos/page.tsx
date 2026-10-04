"use client";

import { useFavorites } from "@/app/context/FavoritesContext";
import { EventCard } from "@/lib/shared";
import { partirFavoritos } from "@/lib/favoritos";
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

  // Los que ya no. No es una idea bonita, y la razón es el 404: la
  // mayoría de los scrapers filtran el pasado ellos mismos, así que el día que el
  // evento ocurre desaparece del agregado y `/evento/[slug]` deja de resolverlo
  // aunque siga guardado en `localStorage`. El favorito no se rompía: se quedaba
  // apuntando a una página que ya no existe. La regla está en `lib/favoritos.ts`,
  // que es pura y se testea en `node`; el `new Date() < new Date()` a mano aquí
  // compararía instantes y no días, y un evento de la madrugada salía como futuro
  // un día y como pasado al siguiente.
  const { futuros, pasados } = partirFavoritos(favorites);

  return (
    <div className="px-5 sm:px-6 max-w-7xl mx-auto pt-28 pb-32">
      <header className="mb-12">
        <div className="flex items-center gap-2 mb-3">
          <span aria-hidden="true" className="inline-block h-5 w-[3px] rounded-full bg-accent" />
          <span className="font-display italic text-accent text-sm">Favoritos</span>
        </div>
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
          {futuros.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {futuros.map((evento) => (
                <EventCard key={evento.id} evento={evento} />
              ))}
            </div>
          )}

          {pasados.length > 0 && (
            <section className={futuros.length > 0 ? "mt-16" : ""} aria-labelledby="favoritos-pasados">
              <h2
                id="favoritos-pasados"
                className="font-display text-xl text-fg-muted mb-2 tracking-[-0.01em]"
              >
                Ya han pasado
              </h2>
              {/* Esto no es decorativo: son los favoritos que el usuario guardó y
                  que ya no se pueden ver en su ficha. Decirlo evita que la lista
                  parezca más corta de lo que es, que es el mismo motivo por el que
                  `/conciertos` enseña el recuento sin recortar. */}
              <p className="text-fg-subtle text-sm mb-6 max-w-2xl">
                {pasados.length === 1
                  ? "Un evento que guardaste ya ha ocurrido. Puedes ir a su ficha original."
                  : `${pasados.length} eventos que guardaste ya han ocurrido. Puedes ir a la ficha original de cada uno.`}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {pasados.map((evento) => (
                  <EventCard
                    key={evento.id}
                    evento={evento}
                    pasado
                    /* Sin enlace guardado no hay a dónde ir, y una tarjeta sin
                       destino es un elemento interactivo que no hace nada: mejor
                       que abra la ficha del evento en la web, que es lo más cerca
                       que queda. */
                    href={evento.link || `/evento/${evento.slug}`}
                  />
                ))}
              </div>
            </section>
          )}

          <PushNotifications />
        </>
      )}
    </div>
  );
}
