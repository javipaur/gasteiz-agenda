"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Landmark,
  Footprints,
  ExternalLink,
  MapPin,
  CalendarDays,
} from "lucide-react";
import { InViewWrapper } from "@/lib/shared";
import { SECTION_TINT } from "@/lib/sectionTint";
import { formatDate } from "@/lib/utils";
import EmptyState from "./EmptyState";
import type { FichaCurada, Ruta, InfoPractica } from "@/lib/turismo";
import type { Evento } from "@/lib/eventos";

type Props = {
  queVer: FichaCurada[];
  rutas: Ruta[];
  info: InfoPractica;
  visitas: Evento[];
};

type Tab = "ver" | "rutas" | "visitas" | "info";

const TABS: { key: Tab; label: string }[] = [
  { key: "ver", label: "Qué ver" },
  { key: "rutas", label: "Rutas y naturaleza" },
  { key: "visitas", label: "Visitas guiadas" },
  { key: "info", label: "Info práctica" },
];

const ICONS: Record<string, () => React.ReactNode> = {
  train: () => <Landmark size={18} aria-hidden="true" />,
  bus: () => <MapPin size={18} aria-hidden="true" />,
  bed: () => <Landmark size={18} aria-hidden="true" />,
  info: () => <CalendarDays size={18} aria-hidden="true" />,
};

export default function TurismoPageClient({ queVer, rutas, info, visitas }: Props) {
  const [tab, setTab] = useState<Tab>("ver");

  return (
    <div className="px-5 sm:px-6 max-w-7xl mx-auto pt-28 pb-32">
      <InViewWrapper>
        <header className="mb-12">
          <div className="flex items-center gap-2 mb-3">
            <span aria-hidden="true" className={`inline-block h-5 w-[3px] rounded-full ${SECTION_TINT.turismo.bar}`} />
            <span className={`font-display italic ${SECTION_TINT.turismo.text} text-sm`}>Turismo</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl text-fg mb-3 tracking-[-0.02em]">
            Descubre Vitoria-Gasteiz
          </h1>
          <p className="text-fg-muted max-w-2xl">
            Qué ver, rutas por el Anillo Verde, visitas guiadas e información práctica
          </p>
        </header>
      </InViewWrapper>

      <InViewWrapper delay={0.1}>
        <div className="flex gap-2 mb-8 flex-wrap" role="tablist" aria-label="Secciones de turismo">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer rounded-full ${
                tab === t.key
                  ? `${SECTION_TINT.turismo.active}`
                  : "bg-bg-muted text-fg-muted hover:text-fg hover:bg-border"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </InViewWrapper>

      {tab === "ver" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {queVer.map((item, index) => (
            <InViewWrapper key={item.slug} delay={Math.min(index * 0.04, 0.4)}>
              <article className="group double-bezel-outer rounded-2xl p-1.5 h-full">
                <div className="double-bezel rounded-xl overflow-hidden h-full flex flex-col">
                  <div className="p-5 flex-1">
                    <h3 className="font-display text-lg font-semibold text-fg mb-1 leading-tight tracking-[-0.01em]">
                      {item.nombre}
                    </h3>
                    {item.zona && (
                      <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-teal mb-3">
                        {item.zona}
                      </p>
                    )}
                    <p className="text-sm text-fg leading-relaxed mb-4">{item.descripcion}</p>
                    {item.tags && (
                      <ul className="flex flex-wrap gap-1.5" aria-label="Etiquetas">
                        {item.tags.map((tag) => (
                          <li
                            key={tag}
                            className="font-mono text-[10px] uppercase tracking-[0.1em] text-fg-subtle bg-bg-muted px-2 py-0.5 rounded"
                          >
                            {tag}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {(item.linkMaps || item.linkOficial) && (
                    <div className="flex border-t border-border">
                      {item.linkOficial && (
                        <a
                          href={item.linkOficial}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Web oficial de ${item.nombre}`}
                          className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-fg-muted hover:text-accent hover:bg-bg-muted transition-colors duration-300"
                        >
                          <ExternalLink size={14} aria-hidden="true" />
                          Web
                        </a>
                      )}
                      {item.linkMaps && (
                        <a
                          href={item.linkMaps}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Ver ${item.nombre} en Google Maps`}
                          className={`${item.linkOficial ? "border-l" : "flex-1"} border-border flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-fg-muted hover:text-accent hover:bg-bg-muted transition-colors duration-300`}
                        >
                          <MapPin size={14} aria-hidden="true" />
                          Cómo llegar
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </article>
            </InViewWrapper>
          ))}
        </div>
      )}

      {tab === "rutas" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {rutas.map((ruta, index) => (
            <InViewWrapper key={ruta.slug} delay={Math.min(index * 0.04, 0.4)}>
              <article className="double-bezel rounded-2xl p-5 h-full flex flex-col">
                <p
                  className={`inline-flex w-fit items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em] rounded px-2 py-0.5 mb-3 ${
                    ruta.dificultad === "Baja"
                      ? "text-green bg-bg-muted"
                      : ruta.dificultad === "Media"
                        ? "text-amber bg-amber-soft"
                        : "text-accent bg-accent-soft"
                  }`}
                >
                  <Footprints size={12} aria-hidden="true" />
                  Dificultad {ruta.dificultad.toLowerCase()}
                </p>
                <h3 className="font-display text-lg font-semibold text-fg mb-1 leading-tight">
                  {ruta.nombre}
                </h3>
                <p className="font-mono text-xs text-fg-subtle mb-3">
                  {ruta.duracion} · {ruta.distancia}
                </p>
                <p className="text-sm text-fg leading-relaxed mb-4 flex-1">
                  {ruta.descripcion}
                </p>
                <p className="flex items-start gap-1.5 text-xs text-fg-subtle mb-4">
                  <MapPin size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                  Salida: {ruta.puntoSalida}
                </p>
                {ruta.linkMaps && (
                  <a
                    href={ruta.linkMaps}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Ver salida de ${ruta.nombre} en Google Maps`}
                    className="flex items-center justify-center gap-1.5 border-t border-border pt-3 text-sm font-medium text-fg-muted hover:text-accent transition-colors duration-300"
                  >
                    <ExternalLink size={14} aria-hidden="true" />
                    Ver en Google Maps
                  </a>
                )}
              </article>
            </InViewWrapper>
          ))}
        </div>
      )}

      {tab === "visitas" && (
        visitas.length === 0 ? (
          <EmptyState
            icon={<CalendarDays size={20} />}
            title="No hay visitas guiadas estos días"
            hint="Puede que en otras categorías de la agenda encuentres tu plan."
            action={{ href: "/culture", label: "Ver agenda cultural" }}
          />
        ) : (
          <ul className="space-y-3">
            {visitas.map((ev) => {
              const { day, month } = formatDate(ev.date);
              return (
                <li key={ev.id || `${ev.title}-${ev.date}`}>
                  <Link
                    href={`/evento/${ev.slug}`}
                    className="flex items-center gap-4 double-bezel rounded-xl p-4 hover:border-accent/40 transition-all duration-300"
                  >
                    <span className="grid w-14 shrink-0 place-items-center rounded-lg bg-teal-soft text-center leading-tight py-1.5">
                      <span className="block font-mono text-[10px] uppercase text-teal">
                        {month}
                      </span>
                      <span className="block font-display text-lg font-semibold text-fg">
                        {day}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-base font-semibold text-fg leading-snug truncate">
                        {ev.title}
                      </span>
                      <span className="block font-mono text-xs text-fg-subtle truncate">
                        {ev.location}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )
      )}

      {tab === "info" && (
        <div>
          <p className="text-lg text-fg-muted max-w-2xl mb-8">{info.intro}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {info.bloques.map((bloque) => (
              <article key={bloque.id} className="double-bezel rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="grid size-9 place-items-center rounded-xl bg-teal-soft text-teal">
                    {ICONS[bloque.icono]?.()}
                  </span>
                  <h3 className="font-display text-base font-semibold text-fg">{bloque.titulo}</h3>
                </div>
                <ul className="space-y-2">
                  {bloque.items.map((item, i) => (
                    <li key={i} className="text-sm text-fg-muted leading-relaxed list-disc list-inside">
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}