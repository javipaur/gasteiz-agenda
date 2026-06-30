"use client";

import ContinuousCarousel from "./ContinuousCarousel";

type Evento = {
  id: string;
  title: string;
  date: string;
  image?: string;
  location?: string;
  link?: string;
};

export default function HomeEventsClient({
  eventos,
}: {
  eventos: Evento[];
}) {
  return (
    <section className="py-16 md:py-24 px-4 md:px-8 bg-paper-dark">
      <div className="max-w-7xl mx-auto mb-8 flex justify-between items-end">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="font-display text-3xl md:text-4xl text-ink font-bold">
              Próximos eventos
            </h2>
            <span className="h-px flex-1 bg-stone max-w-20 hidden sm:block" aria-hidden="true" />
          </div>
          <p className="text-ink-light">
            Planes, cultura y deporte cerca de ti
          </p>
        </div>

        <a
          href="/culture"
          className="hidden md:inline-block font-mono text-sm text-red hover:text-red-dark transition-colors tracking-wide uppercase"
        >
          Ver todos
        </a>
      </div>

      {eventos.length ? (
        <ContinuousCarousel eventos={eventos} />
      ) : (
        <p className="text-center text-ink-light py-12">
          No hay eventos disponibles
        </p>
      )}

      <div className="mt-8 text-center md:hidden">
        <a
          href="/culture"
          className="inline-block px-6 py-3 bg-green text-white rounded-full font-body text-sm hover:bg-green/90 transition-colors"
        >
          Ver todos los eventos
        </a>
      </div>
    </section>
  );
}
