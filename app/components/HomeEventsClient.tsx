"use client";

import { InViewWrapper, EventCard } from "@/lib/shared";
import { CATEGORY_COLORS } from "@/lib/categories";
import SectionHead from "./SectionHead";
import EmptyState from "./EmptyState";

/**
 * `AgendaEvento` menos lo que esta sección no usa. `slug` es obligatorio porque
 * `EventCard` lo exige: la tarjeta enlaza con `evento.slug` y el detalle resuelve
 * contra `AgendaEvento.slug`.
 */
type Evento = {
  id: string;
  slug: string;
  title: string;
  date: string;
  image?: string;
  location?: string;
  link?: string;
  category?: string;
  source?: string;
};

/**
 * Lo que viene **después** de esta semana. `eventos` ya llega cortado desde
 * `EventsWithData` con `partirEnSemana`, y por eso aquí no hay ninguna resta de
 * fechas: el corte se decide una sola vez, en el servidor, y con la misma función
 * que usa la rejilla de siete pestañas. Cuando esto se llamaba «Próximos eventos»
 * recibía la agenda entera y hacía `slice(0, 12)`, y las doce tarjetas eran doce
 * veces lo que ya estaba arriba.
 *
 * `mesHref` es `/agenda/AAAA-MM` y llega como prop por el mismo motivo: el mes es
 * una lectura del reloj, y un reloj leído en el cliente puede no coincidir con el
 * que hidrató el servidor.
 */
export default function HomeEventsClient({
  eventos,
  mesHref,
}: {
  eventos: Evento[];
  mesHref: string;
}) {
  return (
    <section className="py-12 md:py-16 px-5 sm:px-6 bg-bg-muted">
      <div className="max-w-7xl mx-auto">
        <InViewWrapper>
          <SectionHead
            tag="Agenda"
            title="Más adelante"
            subtitle="Lo que viene después de esta semana en Vitoria-Gasteiz."
            href={mesHref}
            linkLabel="La agenda completa"
            color="var(--violet)"
          />
        </InViewWrapper>

        {eventos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {eventos.slice(0, 12).map((evento, i) => (
              <InViewWrapper
                key={evento.id}
                delay={i * 0.04}
                className={i === 0 && eventos.length >= 4 ? "sm:col-span-2 xl:col-span-2" : undefined}
              >
                <EventCard
                  evento={evento}
                  categoryColors={CATEGORY_COLORS}
                  priority={i < 4}
                  size={i === 0 && eventos.length >= 4 ? "large" : "normal"}
                />
              </InViewWrapper>
            ))}
          </div>
        ) : (
          /* Este vacío no es el de antes. Antes significaba «la agenda está en
             blanco», y era cierto porque la sección recibía todo: si no había
             nada, no había nada. Ahora la sección solo ve lo de después de la
             semana, así que cero significa «no hay nada anunciado más allá», que
             es una frase muy distinta y no dice nada del día de hoy. */
          <InViewWrapper>
            <EmptyState
              icon={
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <rect x="2.5" y="4" width="15" height="13" rx="2" />
                  <path d="M2.5 8h15M6.5 2.5V5M13.5 2.5V5" />
                </svg>
              }
              title="Nada anunciado más allá de esta semana"
              hint="Lo de estos siete días ya está arriba. El calendario municipal se publica con meses de antelación, así que esto se llena solo."
              action={{ href: mesHref, label: "Ver la agenda del mes" }}
            />
          </InViewWrapper>
        )}
      </div>
    </section>
  );
}
