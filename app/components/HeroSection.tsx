"use client";

import { useMemo } from "react";
import { InViewWrapper } from "@/lib/shared";
import HeroSearch from "./HeroSearch";
import { esEstaSemana, esHoy } from "@/lib/at-a-glance";
import { formatDate, shortTime } from "@/lib/utils";
import type { Evento } from "@/lib/eventos";

/**
 * La portada abre con una **pregunta**, no con un plan elegido por nadie.
 *
 * ## Por qué el hero ya no pinta tarjetas
 *
 * El hero tenía tres destacados y, debajo, «Próximos 7 días» y el riel de
 * recomendados volvían a pintar los mismos eventos. Medido el 23 de octubre de
 * 2026, doce tarjetas de la última sección eran las doce de la anterior; con el
 * hero pasaba lo mismo en la primera pantalla. Tres sitios distintos
 * enseñando el mismo dato no dan tres formas de mirarlo: dan una home que
 * parece no tener nada nuevo que decir.
 *
 * Aquí solo quedan identidad, buscador y dos contadores. La decisión de qué
 * hacer con el día va al bloque «Hoy en Vitoria», y la de qué merece la pena va
 * a «Qué recomendamos». El hero es la puerta, no el contenido.
 *
 * ## Los contadores son agregados, no tarjetas
 *
 * `N planes hoy · N esta semana` dicen si la agenda está viva sin ocupar el
 * sitio de un evento. Se calculan con las mismas funciones que `lib/at-a-glance`
 * usa en el resto del sitio, para que el número del hero y el de la tira no
 * puedan divergir. El instante llega como prop: un `useMemo` que leyera
 * `Date.now()` es impuro y puede devolver su valor cacheado para siempre.
 *
 * ## Navidad no es un destacado
 *
 * Los planes de Navidad llegan ya filtrados por día desde el servidor. Este
 * componente no decide qué día es ni abre la ventana: solo pinta lo que le
 * llega, igual que hace con `ahora`. No entran en el registro de 28 fuentes,
 * así que cada línea abre directamente su fuente oficial y no un detalle que
 * no existe.
 */
export default function HeroSection({
  eventos,
  ahora,
  navidad = [],
}: {
  eventos: Evento[];
  /** Los planes de Navidad ya filtrados por día en el servidor. */
  navidad?: Evento[];
  /** El instante contra el que se cuentan el día y la semana, en ms. */
  ahora: number;
}) {
  const { hoy, semana } = useMemo(() => {
    const instante = new Date(ahora);
    return {
      hoy: eventos.filter((e) => esHoy(e.date, instante)).length,
      semana: eventos.filter((e) => esEstaSemana(e.date, instante)).length,
    };
  }, [eventos, ahora]);

  return (
    <section className="px-5 sm:px-6 pt-28 pb-12 md:pt-36 md:pb-16">
      <InViewWrapper>
        <div className="max-w-5xl mx-auto">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-accent mb-6">
            La agenda de Vitoria-Gasteiz
          </p>
          <h1 className="font-display text-[clamp(2.75rem,8vw,6rem)] font-black uppercase tracking-[-0.04em] text-fg leading-[0.9] text-balance">
            Qué hacer en Gasteiz
          </h1>
          <p className="text-base md:text-xl text-fg-muted mt-5 max-w-xl text-pretty">
            Todo lo que pasa en la ciudad, en un solo sitio. Empieza por hoy o
            dinos qué te apetece.
          </p>

          <div className="mt-10 max-w-2xl">
            <HeroSearch />
          </div>

          <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.12em] text-fg-subtle" aria-live="polite">
            {hoy} planes hoy <span aria-hidden="true">·</span> {semana} esta semana
          </p>

          {navidad.length > 0 && (
            <InViewWrapper delay={0.15}>
              {/*
                Navidad no entra en el registro de 28 fuentes, así que no tiene
                `/evento/[slug]`: cada línea abre directamente la fuente oficial que se
                verificó. Y la hora que no se publicó se dice «por confirmar» en vez
                de quedarse en blanco, que parece un olvido.
              */}
              <div className="mt-10 rounded-2xl border border-border bg-surface p-5">
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-fg-subtle">
                  Navidad 2026
                </p>
                <ul className="mt-3 space-y-2">
                  {navidad.map((evento) => {
                    const { day, month } = formatDate(evento.date);
                    const time = shortTime(evento.time);
                    return (
                      <li key={evento.id} className="py-1">
                        <a
                          href={evento.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-baseline justify-between gap-3 text-sm text-fg hover:text-accent"
                        >
                          <span className="min-w-0 truncate">{evento.title}</span>
                          <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] text-fg-subtle">
                            {day} {month}
                            {time ? ` · ${time}` : " · hora por confirmar"}
                          </span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-subtle">
                  Consulta cambios en la web oficial
                </p>
              </div>
            </InViewWrapper>
          )}
        </div>
      </InViewWrapper>
    </section>
  );
}
