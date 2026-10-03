"use client";

import { InViewWrapper, EventCard } from "@/lib/shared";
import { BLANCA_COLORS, mapFiestaToCard } from "./blanca";
import { blancaEditionYear } from "@/lib/blanca";
import { localDateStr } from "@/lib/utils";
import type { FiestaBlanca } from "@/lib/sources/fiestas-blanca";
import SectionHead from "./SectionHead";


export default function FiestasBlancaSection({
  fiestas,
  ahora,
}: {
  fiestas: FiestaBlanca[];
  /**
   * El instante contra el que se decide qué fiestas quedan por pasar, en ms.
   *
   * Antes se leía `new Date()` **en el cuerpo del componente**, y eso eran dos fallos
   * en una línea:
   *
   * 1. **Era una impureza en render.** El valor se calculaba en cada render y no
   *    estaba en ninguno, así que era un valor nuevo en cada pasada sin que nada lo
   *    pidiera: la lista podía quedar filtrada contra un momento distinto del que la
   *    persona está mirando. En `HeroSection` y en `NextDaysSection` esto ya se había
   *    resuelto con un prop, y el motivo de que fuera un `useMemo` allí y no aquí es
   *    que allí el memo **podía devolver su valor cacheado para siempre**: leer el
   *    reloj dentro de un memo es lo que hace que eso ocurra. Aquí el daño es menor —
   *    la lista se recalcula— y sin embargo el mismo prop lo deja resuelto.
   * 2. **Usaba UTC para una fecha local.** `new Date().toISOString().slice(0, 10)` es
   *    el día **UTC**, y el día que ve la persona es el local: entre las 00:00 y las
   *    01:59 de Europe/Madrid el primero ya ha cambiado y el segundo todavía no
   *    (medido: el UTC cruza la medianoche a las 23:00Z en invierno y a las 22:00Z en
   *    verano). Durante esas dos horas la sección descartaba la fiesta de hoy y
   *    pintaba la de ayer.
   *
   * Lo que sustituye a `toISOString()` es `localDateStr`, la misma función que usa
   * `NextDaysSection`, y no un `getFullYear()/getMonth()/getDate()` a mano: "el día
   * que ve el usuario" tiene que tener una sola definición en el repo, porque
   * cualquier otra es una copia que se puede separar.
   */
  ahora: number;
}) {
  if (fiestas.length === 0) return null;

  const hoy = localDateStr(new Date(ahora));

  const upcoming = fiestas.filter((f) => f.date >= hoy).slice(0, 12);

  if (upcoming.length === 0) return null;

  const dates = fiestas.map((f) => f.date).filter(Boolean).sort();
  const fmt = (s: string) =>
    new Date(`${s}T00:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  const range =
    dates.length > 1 ? `${fmt(dates[0])} – ${fmt(dates[dates.length - 1])}` : "";
  // El año también sale del prop y no de un `new Date()` suelto: era el segundo reloj
  // en el cuerpo de este mismo componente, y dejar uno solo para el año dejaría el
  // componente a medio purificar —"a veces" el render es determinista, que es peor
  // que no serlo.
  const year = blancaEditionYear(dates) ?? new Date(ahora).getFullYear();

  return (
    <section className="py-16 md:py-20 px-5 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <InViewWrapper>
          <SectionHead
            tag="Fiestas"
            title={`La Blanca ${year}`}
            subtitle={range ? `${range} · Programación completa` : "Programación completa"}
            href="/fiestas-blanca"
            linkLabel="Ver programa completo"
            color="var(--hot)"
          />
        </InViewWrapper>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {upcoming.map((f, i) => (
            <InViewWrapper key={f.id} delay={i * 0.04}>
              <EventCard
                evento={mapFiestaToCard(f)}
                categoryColors={BLANCA_COLORS}
              />
            </InViewWrapper>
          ))}
        </div>
      </div>
    </section>
  );
}
