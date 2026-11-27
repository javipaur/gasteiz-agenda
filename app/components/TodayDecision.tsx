"use client";

import Link from "next/link";
import Image from "next/image";
import { propsImagen } from "@/lib/image-proxy";
import { shortTime } from "@/lib/utils";
import { CATEGORY_COLORS, normalizeCategory } from "@/lib/categories";
import type { Evento } from "@/lib/eventos";
import { InViewWrapper } from "@/lib/shared";
import SectionHead from "./SectionHead";

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3l5 5-5 5" />
    </svg>
  );
}

/**
 * `Hoy en Vitoria` es una **decisión corta**, no un horario ni una lista entera.
 *
 * ## Por qué no hay pestañas por franja horaria
 *
 * Medido el 24 de noviembre de 2026 sobre la agenda en vivo: **69 eventos hoy y
 * solo 20 traen hora** (`19:00`, `20:30`, `11:00`…). El resto son sobre todo
 * exposiciones, que se publican con día pero sin franja. Una barra de «Mañana /
 * Tarde / Noche» prometería una precisión que los datos no tienen, y el fallo
 * sería silencioso: la noche saldría vacía aunque hubiera planes, y nadie podría
 * distinguir «no hay nada» de «no lo sabemos».
 *
 * Lo que sí es honesto es enseñar la hora **cuando la fuente la da** y callarla
 * cuando no. Por eso la hora es un fragmento opcional dentro de cada fila, y no
 * una columna ni un filtro.
 *
 * ## Por qué seis y no todos
 *
 * El día con más planes medido en la portada vieja tenía 112 tarjetas y 10.474
 * px de rejilla. Aquí el bloque responde a «¿qué hago hoy?» en un vistazo: hasta
 * seis, con el total visible en la cabecera y un enlace a `/hoy`, que es la
 * lista completa y filtrable. La elección de cuáles seis no es el azar del
 * `slice`: entra primero lo que tiene hora y luego lo que no, para que la fila
 * más accionable esté arriba. La elección no se hace aquí: la hace
 * `lib/home-seleccion.ts` en el servidor, una sola vez por petición y con el
 * mismo conjunto que excluye el riel de abajo. Si este componente volviera a
 * cortar por su cuenta, las dos secciones podrían volver a repetirse sin que
 * ningún test de este fichero lo viera.
 */
export default function TodayDecision({
  planesDeHoy,
  totalDeHoy,
}: {
  planesDeHoy: Evento[];
  /** El total del día, que es lo que dice la cabecera y el enlace a `/hoy`. */
  totalDeHoy: number;
}) {
  if (planesDeHoy.length === 0) return null;

  return (
    <section aria-labelledby="hoy-en-vitoria" className="px-5 sm:px-6 py-10 md:py-14 bg-bg-muted">
      <div className="max-w-7xl mx-auto">
        <InViewWrapper>
          <div className="flex items-end justify-between gap-4 mb-6">
            <div className="min-w-0">
              <SectionHead
                id="hoy-en-vitoria"
                tag="Hoy"
                title="Hoy en Vitoria"
                subtitle={`${totalDeHoy} planes con fecha de hoy`}
                color="var(--lime)"
              />
            </div>
          </div>
        </InViewWrapper>

        <InViewWrapper>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {planesDeHoy.map((evento) => {
              const imagen = propsImagen(evento.image);
              const color = CATEGORY_COLORS[normalizeCategory(evento.category)] || "var(--accent)";
              const hora = shortTime(evento.time);
              return (
                <li key={evento.id}>
                  <Link
                    href={`/evento/${evento.slug}`}
                    className="group flex items-center gap-3 rounded-2xl border border-border bg-surface p-2.5 min-h-[84px] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent/5 active:scale-[0.98]"
                  >
                    <span className="relative w-16 h-16 sm:w-[72px] sm:h-[72px] shrink-0 rounded-xl overflow-hidden bg-bg-muted">
                      {imagen ? (
                        <Image
                          {...imagen}
                          alt=""
                          fill
                          sizes="72px"
                          className="object-cover transition-transform duration-[800ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <span className="absolute inset-0 grid place-items-center font-display text-2xl text-accent/25" aria-hidden="true">
                          {evento.title.charAt(0)}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      {/* El punto es gráfico, no texto: distingue la categoría sin
                          repetir la pastilla de color de la tarjeta. */}
                      <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-subtle">
                        <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} aria-hidden="true" />
                        {hora || evento.category || "Plan"}
                      </span>
                      <span className="block font-display text-sm font-semibold text-fg leading-snug line-clamp-2 mt-0.5">
                        {evento.title}
                      </span>
                      {evento.location && (
                        <span className="block text-[11px] text-fg-muted truncate mt-0.5">{evento.location}</span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </InViewWrapper>

        <p className="sm:hidden mt-4">
          <Link href="/hoy" className="inline-flex items-center gap-1 text-sm text-accent">
            Ver los {totalDeHoy} planes de hoy
            <ArrowIcon className="w-3.5 h-3.5" />
          </Link>
        </p>
      </div>
    </section>
  );
}
