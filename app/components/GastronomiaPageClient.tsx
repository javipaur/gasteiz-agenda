"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Utensils, MapPin, CalendarDays, ExternalLink, Star } from "lucide-react";
import { InViewWrapper } from "@/lib/shared";
import { eventSlug } from "@/lib/slug";
import { formatDate } from "@/lib/utils";
import EmptyState from "./EmptyState";
import type { Sitio, RutaPintxo } from "@/lib/gastronomia";
import type { Evento } from "@/lib/eventos";

type Props = {
  sitios: Sitio[];
  rutas: RutaPintxo[];
  eventos: Evento[];
};

type Tab = "sitios" | "rutas" | "agenda";

const TABS: { key: Tab; label: string }[] = [
  { key: "sitios", label: "Dónde comer" },
  { key: "rutas", label: "Rutas de pintxos" },
  { key: "agenda", label: "Agenda gastronómica" },
];

export default function GastronomiaPageClient({ sitios, rutas, eventos }: Props) {
  const [tab, setTab] = useState<Tab>("sitios");
  const [barrio, setBarrio] = useState<string>("all");

  const barrios = useMemo(
    () => Array.from(new Set(sitios.map((s) => s.barrio))).sort(),
    [sitios]
  );

  const filteredSitios = useMemo(
    () => (barrio === "all" ? sitios : sitios.filter((s) => s.barrio === barrio)),
    [sitios, barrio]
  );

  const precio = (p: Sitio["rangoPrecio"]) => (
    <span className="font-mono text-xs text-amber" aria-label={`Precio ${p}`}>
      {p}
    </span>
  );

  return (
    <div className="px-5 sm:px-6 max-w-7xl mx-auto pt-28 pb-32">
      <InViewWrapper>
        <header className="mb-12">
          <p className="font-mono text-xs tracking-[0.2em] uppercase text-amber mb-3">
            Gastronomía
          </p>
          <h1 className="font-display text-4xl md:text-5xl text-fg mb-3 tracking-[-0.02em]">
            Dónde comer en Vitoria-Gasteiz
          </h1>
          <p className="text-fg-muted max-w-2xl">
            Rutas de pintxos, sitios recomendados y eventos gastronómicos
          </p>
        </header>
      </InViewWrapper>

      <InViewWrapper delay={0.1}>
        <div className="flex gap-2 mb-4 flex-wrap" role="tablist" aria-label="Secciones de gastronomía">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer rounded-full ${
                tab === t.key
                  ? "bg-amber text-white"
                  : "bg-bg-muted text-fg-muted hover:text-fg hover:bg-border"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "sitios" && barrios.length > 1 && (
          <div className="flex gap-2 mb-8 flex-wrap">
            <button
              onClick={() => setBarrio("all")}
              aria-pressed={barrio === "all"}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 cursor-pointer ${
                barrio === "all"
                  ? "bg-amber-soft text-amber"
                  : "bg-bg-muted text-fg-subtle hover:text-fg-muted"
              }`}
            >
              Todos
            </button>
            {barrios.map((b) => (
              <button
                key={b}
                onClick={() => setBarrio(b)}
                aria-pressed={barrio === b}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 cursor-pointer ${
                  barrio === b
                    ? "bg-amber-soft text-amber"
                    : "bg-bg-muted text-fg-subtle hover:text-fg-muted"
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        )}
      </InViewWrapper>

      {tab === "sitios" && (
        filteredSitios.length === 0 ? (
          <EmptyState
            icon={<Utensils size={20} />}
            title="Sin resultados"
            hint="Prueba con otro barrio."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredSitios.map((sitio, index) => (
              <InViewWrapper key={sitio.slug} delay={Math.min(index * 0.04, 0.4)}>
                <article className="group double-bezel-outer rounded-2xl p-1.5 h-full">
                  <div className="double-bezel rounded-xl overflow-hidden h-full flex flex-col">
                    {sitio.imagen && (
                      <div className="relative aspect-[16/9] shrink-0">
                        <Image
                          src={sitio.imagen}
                          alt={`Fachada de ${sitio.nombre}`}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                          className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105"
                        />
                      </div>
                    )}
                    <div className="p-5 flex-1">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-display text-lg font-semibold text-fg leading-tight tracking-[-0.01em]">
                          {sitio.nombre}
                        </h3>
                        {sitio.rangoPrecio && precio(sitio.rangoPrecio)}
                      </div>
                      {sitio.recomendado && (
                        <p className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em] text-amber bg-amber-soft px-2 py-0.5 rounded mb-3">
                          <Star size={12} strokeWidth={1.5} />
                          Recomendado
                        </p>
                      )}
                      <p className="text-sm text-fg-muted mb-3">{sitio.tipoCocina} · {sitio.barrio}</p>
                      <p className="text-sm text-fg leading-relaxed mb-4">{sitio.descripcion}</p>
                      <p className="flex items-start gap-1.5 text-xs text-fg-subtle mb-4">
                        <MapPin size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                        {sitio.direccion}
                      </p>
                    </div>
                    {sitio.linkMaps && (
                      <a
                        href={sitio.linkMaps}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Ver ${sitio.nombre} en Google Maps`}
                        className="flex items-center justify-center gap-1.5 border-t border-border py-3 text-sm font-medium text-fg-muted hover:text-accent hover:bg-bg-muted transition-colors duration-300"
                      >
                        <ExternalLink size={14} aria-hidden="true" />
                        Cómo llegar
                      </a>
                    )}
                  </div>
                </article>
              </InViewWrapper>
            ))}
          </div>
        )
      )}

      {tab === "rutas" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {rutas.map((ruta, index) => (
            <InViewWrapper key={ruta.slug} delay={Math.min(index * 0.04, 0.4)}>
              <article className="double-bezel rounded-2xl p-5 h-full">
                <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-amber mb-2">
                  {ruta.zona}
                </p>
                <h3 className="font-display text-lg font-semibold text-fg mb-1 leading-tight">
                  {ruta.nombre}
                </h3>
                <p className="font-mono text-xs text-fg-subtle mb-4">
                  Duración: {ruta.duracion}
                </p>
                <ol className="space-y-3 mb-4">
                  {ruta.paradas.map((parada, i) => (
                    <li key={`${parada.nombre}-${i}`} className="flex gap-3">
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-amber-soft text-amber font-mono text-xs font-bold">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-fg">{parada.nombre}</p>
                        <p className="text-xs text-fg-muted">
                          {parada.pintxo} · {parada.precio}
                        </p>
                        <p className="text-xs text-fg-subtle">{parada.direccion}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                {ruta.consejo && (
                  <p className="text-xs text-fg-muted border-t border-border pt-3">
                    💡 {ruta.consejo}
                  </p>
                )}
              </article>
            </InViewWrapper>
          ))}
        </div>
      )}

      {tab === "agenda" && (
        eventos.length === 0 ? (
          <EmptyState
            icon={<CalendarDays size={20} />}
            title="No hay eventos gastronómicos estos días"
            hint="Vuelve pronto: publicamos la agenda a diario."
          />
        ) : (
          <ul className="space-y-3">
            {eventos.map((ev) => {
              const { day, month } = formatDate(ev.date);
              return (
                <li key={ev.id || `${ev.title}-${ev.date}`}>
                  <Link
                    href={`/evento/${eventSlug(ev)}`}
                    className="flex items-center gap-4 double-bezel rounded-xl p-4 hover:border-accent/40 transition-all duration-300"
                  >
                    <span className="grid w-14 shrink-0 place-items-center rounded-lg bg-amber-soft text-center leading-tight py-1.5">
                      <span className="block font-mono text-[10px] uppercase text-amber">
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
    </div>
  );
}