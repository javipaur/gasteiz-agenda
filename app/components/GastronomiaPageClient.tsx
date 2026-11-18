"use client";

import { useCallback, useRef, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { propsImagen } from "@/lib/image-proxy";
import {
  Utensils,
  MapPin,
  CalendarDays,
  ExternalLink,
  Star,
  Trophy,
  ChevronDown,
  Info,
} from "lucide-react";
import { InViewWrapper } from "@/lib/shared";
import { SECTION_TINT } from "@/lib/sectionTint";
import { formatDate } from "@/lib/utils";
import EmptyState from "./EmptyState";
import type {
  Sitio,
  RutaPintxo,
  EnsaladillaCampeonato,
  EstadoEnsaladilla,
} from "@/lib/gastronomia";
import type { Evento } from "@/lib/eventos";

type Props = {
  sitios: Sitio[];
  rutas: RutaPintxo[];
  eventos: Evento[];
  ensaladilla?: EnsaladillaCampeonato | null;
  ensaladillaEstado?: EstadoEnsaladilla | null;
};

type Tab = "sitios" | "rutas" | "agenda";

const TABS: { key: Tab; label: string }[] = [
  { key: "sitios", label: "Dónde comer" },
  { key: "rutas", label: "Rutas de pintxos" },
  { key: "agenda", label: "Agenda gastronómica" },
];

function formatFechaCorta(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  return dt.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function EnsaladillaDestacado({
  campeonato,
  estado,
  onVerRuta,
}: {
  campeonato: EnsaladillaCampeonato;
  estado: EstadoEnsaladilla | null;
  onVerRuta: () => void;
}) {
  const totalBares = campeonato.zonas.reduce((acc, z) => acc + z.bares.length, 0);
  const enMarcha = estado === "en-marcha";
  const proximo = estado === "proximo";
  const finalizado = estado === "finalizado";

  return (
    <InViewWrapper>
      <section
        aria-labelledby="ensaladilla-titulo"
        className="mb-10 rounded-2xl border border-amber/30 bg-gradient-to-br from-amber/10 via-bg to-bg p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-soft px-3 py-1 text-xs font-semibold text-amber">
              <Trophy size={14} aria-hidden="true" />
              Campeonato gastronómico
            </span>
            {enMarcha && (
              <span className="inline-flex items-center rounded-full bg-green/15 px-3 py-1 text-xs font-semibold text-green">
                En marcha
              </span>
            )}
            {proximo && (
              <span className="inline-flex items-center rounded-full bg-blue/15 px-3 py-1 text-xs font-semibold text-blue">
                Próximamente
              </span>
            )}
            {finalizado && (
              <span className="inline-flex items-center rounded-full bg-bg-muted px-3 py-1 text-xs font-semibold text-fg-muted">
                Edición {campeonato.edicion}
              </span>
            )}
          </div>
          <p className="font-mono text-xs text-fg-subtle">
            {formatFechaCorta(campeonato.fechas.inicio)} –{" "}
            {formatFechaCorta(campeonato.fechas.fin)}{" "}
            {campeonato.fechas.fin.startsWith(String(campeonato.edicion)) ? "" : campeonato.edicion}
          </p>
        </div>

        <h2
          id="ensaladilla-titulo"
          className="font-display text-2xl sm:text-3xl text-fg tracking-[-0.02em] mb-2"
        >
          {campeonato.nombre}
        </h2>
        <p className="text-fg-muted max-w-3xl mb-4">{campeonato.descripcion}</p>

        <div className="flex flex-wrap gap-2 mb-5">
          <span className="inline-flex items-center rounded-full bg-bg-muted px-3 py-1.5 text-xs font-medium text-fg">
            {totalBares} bares
          </span>
          <span className="inline-flex items-center rounded-full bg-bg-muted px-3 py-1.5 text-xs font-medium text-fg">
            {campeonato.zonas.length} zonas
          </span>
          {campeonato.precio && (
            <span className="inline-flex items-center rounded-full bg-bg-muted px-3 py-1.5 text-xs font-medium text-fg-muted">
              {campeonato.precio}
            </span>
          )}
          <span className="inline-flex items-center rounded-full bg-bg-muted px-3 py-1.5 text-xs font-medium text-fg-muted">
            Final: {formatFechaCorta(campeonato.final.fecha)} · {campeonato.final.lugar}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onVerRuta}
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-sec-amber-fill px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer"
          >
            Ver la ruta y los 40 bares
          </button>
          <a
            href={campeonato.fuente.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-fg-muted hover:text-accent transition-colors"
          >
            <ExternalLink size={14} aria-hidden="true" />
            Fuente: {campeonato.fuente.nombre}
          </a>
        </div>
      </section>
    </InViewWrapper>
  );
}

function EnsaladillaDetalle({ campeonato }: { campeonato: EnsaladillaCampeonato }) {
  const [abierta, setAbierta] = useState<string | null>(campeonato.zonas[0]?.nombre ?? null);

  return (
    <article className="double-bezel-outer rounded-2xl p-1.5 mb-6">
      <div className="double-bezel rounded-xl overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-border bg-amber/5">
          <div className="flex items-center gap-2 mb-2">
            <Trophy size={18} className="text-amber" aria-hidden="true" />
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-amber">
              Ruta especial · {campeonato.zonas.length} zonas
            </p>
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-semibold text-fg mb-2 tracking-[-0.01em]">
            {campeonato.nombre}: los {campeonato.zonas.reduce((a, z) => a + z.bares.length, 0)} bares
          </h2>
          <p className="text-sm text-fg-muted">
            {formatFechaCorta(campeonato.fechas.inicio)}–{formatFechaCorta(campeonato.fechas.fin)} ·{" "}
            {campeonato.organiza.join(" y ")}
            {campeonato.precio ? ` · ${campeonato.precio}` : ""}
          </p>
        </div>

        <div className="divide-y divide-border">
          {campeonato.zonas.map((zona) => {
            const isOpen = abierta === zona.nombre;
            const panelId = `zona-${zona.nombre.replace(/\s+/g, "-").toLowerCase()}`;
            return (
              <section key={zona.nombre}>
                <h3>
                  <button
                    type="button"
                    onClick={() => setAbierta(isOpen ? null : zona.nombre)}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className="w-full flex items-center justify-between gap-3 px-5 sm:px-6 py-4 text-left hover:bg-bg-muted/50 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <span className="font-display text-base sm:text-lg font-semibold text-fg">
                        {zona.nombre}
                      </span>
                      <span className="font-mono text-xs text-fg-subtle shrink-0">
                        {zona.bares.length} {zona.bares.length === 1 ? "bar" : "bares"}
                      </span>
                    </span>
                    <ChevronDown
                      size={18}
                      aria-hidden="true"
                      className={`shrink-0 text-fg-subtle transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </h3>
                {isOpen && (
                  <ul id={panelId} className="px-5 sm:px-6 pb-5 space-y-3">
                    {zona.bares.map((bar, i) => (
                      <li
                        key={`${zona.nombre}-${bar.nombre}-${i}`}
                        className="flex gap-3 items-start"
                      >
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-amber-soft text-amber font-mono text-xs font-bold mt-0.5">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-fg">{bar.nombre}</p>
                          <p className="text-sm text-fg-muted">{bar.propuesta}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>

        <div className="px-5 sm:px-6 py-4 border-t border-border flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-fg-subtle">
          <span>Final: {formatFechaCorta(campeonato.final.fecha)} · {campeonato.final.lugar}</span>
          <a
            href={campeonato.fuente.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-accent transition-colors"
          >
            <ExternalLink size={12} aria-hidden="true" />
            Listado en {campeonato.fuente.nombre}
          </a>
        </div>
      </div>
    </article>
  );
}

function PintxoPoteInfo() {
  return (
    <section
      aria-labelledby="pintxo-pote-titulo"
      className="double-bezel-outer rounded-2xl p-1.5 mb-6"
    >
      <div className="double-bezel rounded-xl p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-2">
          <Info size={18} className="text-amber" aria-hidden="true" />
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-amber">
            Información práctica
          </p>
        </div>
        <h2
          id="pintxo-pote-titulo"
          className="font-display text-xl sm:text-2xl font-semibold text-fg mb-2 tracking-[-0.01em]"
        >
          Pintxo-pote en Vitoria-Gasteiz
        </h2>
        <p className="text-sm text-fg-muted mb-4 max-w-3xl">
          Una forma sencilla y económica de ir de pintxos: en muchos bares se ofrece un pintxo y una
          bebida (el «pote») a un precio cerrado. Las rutas y los bares participantes son rotativos y
          cambian según la zona y el día.
        </p>
        <ul className="space-y-1.5 text-sm text-fg mb-4">
          <li>
            <span className="font-medium">Días habituales:</span> miércoles, jueves, viernes y sábados
            (según ruta y zona).
          </li>
          <li>
            <span className="font-medium">Horario habitual:</span> 19:00–23:00.
          </li>
        </ul>
        <p className="text-xs text-fg-subtle mb-4">
          Consulta siempre las fuentes oficiales para ver las rutas y bares vigentes en cada momento.
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <a
            href="https://www.vitoria-gasteiz.org/wb021/was/contenidoAction.do?idioma=es&uid=u_60e9f7db_12cde2ef351__7fc7"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-fg-muted hover:text-accent transition-colors"
          >
            <ExternalLink size={14} aria-hidden="true" />
            Turismo Vitoria-Gasteiz: De pintxos
          </a>
          <a
            href="http://www.guiaestrellavitoria.com/es"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-fg-muted hover:text-accent transition-colors"
          >
            <ExternalLink size={14} aria-hidden="true" />
            Guía Estrella: bares por zonas
          </a>
        </div>
      </div>
    </section>
  );
}

export default function GastronomiaPageClient({
  sitios,
  rutas,
  eventos,
  ensaladilla = null,
  ensaladillaEstado = null,
}: Props) {
  const [tab, setTab] = useState<Tab>("sitios");
  const [barrio, setBarrio] = useState<string>("all");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const onTabsKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const total = TABS.length;
      const actual = TABS.findIndex((t) => t.key === tab);
      let siguiente: number;
      if (e.key === "ArrowRight") siguiente = (actual + 1) % total;
      else if (e.key === "ArrowLeft") siguiente = (actual - 1 + total) % total;
      else if (e.key === "Home") siguiente = 0;
      else if (e.key === "End") siguiente = total - 1;
      else return;
      e.preventDefault();
      setTab(TABS[siguiente]!.key);
      requestAnimationFrame(() => tabRefs.current[siguiente]?.focus());
    },
    [tab]
  );

  const panelId = (clave: Tab) => `gastronomia-panel-${clave}`;

  const barrios = useMemo(
    () => Array.from(new Set(sitios.map((s) => s.barrio))).sort(),
    [sitios]
  );

  const filteredSitios = useMemo(
    () => (barrio === "all" ? sitios : sitios.filter((s) => s.barrio === barrio)),
    [sitios, barrio]
  );

  const precio = (p: Sitio["rangoPrecio"]) => (
    <span className="font-mono text-xs text-amber">
      <span aria-hidden="true">{p}</span>
      <span className="sr-only">Precio {p}</span>
    </span>
  );

  const irARutas = () => {
    setTab("rutas");
    requestAnimationFrame(() => {
      document.getElementById(panelId("rutas"))?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <div className="px-5 sm:px-6 max-w-7xl mx-auto pt-28 pb-32">
      <InViewWrapper>
        <header className="mb-12">
          <div className="flex items-center gap-2 mb-3">
            <span
              aria-hidden="true"
              className={`inline-block h-5 w-[3px] rounded-full ${SECTION_TINT.gastronomia.bar}`}
            />
            <span className={`font-display italic ${SECTION_TINT.gastronomia.text} text-sm`}>
              Gastronomía
            </span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl text-fg mb-3 tracking-[-0.02em]">
            Dónde comer en Vitoria-Gasteiz
          </h1>
          <p className="text-fg-muted max-w-2xl">
            Rutas de pintxos, sitios recomendados y eventos gastronómicos
          </p>
        </header>
      </InViewWrapper>

      {ensaladilla && (
        <EnsaladillaDestacado
          campeonato={ensaladilla}
          estado={ensaladillaEstado ?? null}
          onVerRuta={irARutas}
        />
      )}

      <InViewWrapper delay={0.1}>
        <div
          className="flex gap-2 mb-4 flex-wrap"
          role="tablist"
          aria-label="Secciones de gastronomía"
          onKeyDown={onTabsKeyDown}
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              ref={(el) => {
                tabRefs.current[TABS.indexOf(t)] = el;
              }}
              role="tab"
              id={`gastronomia-tab-${t.key}`}
              aria-selected={tab === t.key}
              aria-controls={panelId(t.key)}
              tabIndex={tab === t.key ? 0 : -1}
              onClick={() => setTab(t.key)}
              className={`min-h-[44px] px-4 text-sm font-medium transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer rounded-full ${
                tab === t.key
                  ? `${SECTION_TINT.gastronomia.active}`
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
              className={`min-w-[44px] min-h-[44px] px-3 rounded-full text-xs font-medium transition-all duration-300 cursor-pointer ${
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
                aria-pressed={b === barrio}
                className={`min-w-[44px] min-h-[44px] px-3 rounded-full text-xs font-medium transition-all duration-300 cursor-pointer ${
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
        <div
          id={panelId("sitios")}
          role="tabpanel"
          aria-labelledby="gastronomia-tab-sitios"
        >
          {filteredSitios.length === 0 ? (
            <EmptyState
              icon={<Utensils size={20} />}
              title="Sin resultados"
              hint="Prueba con otro barrio."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredSitios.map((sitio, index) => {
                const img = propsImagen(sitio.imagen);
                return (
                  <InViewWrapper key={sitio.slug} delay={Math.min(index * 0.04, 0.4)}>
                    <article className="group double-bezel-outer rounded-2xl p-1.5 h-full">
                      <div className="double-bezel rounded-xl overflow-hidden h-full flex flex-col">
                        {img && (
                          <div className="relative aspect-[16/9] shrink-0">
                            <Image
                              {...img}
                              alt={`Fachada de ${sitio.nombre}`}
                              fill
                              sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                              className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105"
                            />
                          </div>
                        )}
                        <div className="p-5 flex-1">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h2 className="font-display text-lg font-semibold text-fg leading-tight tracking-[-0.01em]">
                              {sitio.nombre}
                            </h2>
                            {sitio.rangoPrecio && precio(sitio.rangoPrecio)}
                          </div>
                          {sitio.recomendado && (
                            <p className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em] text-amber bg-amber-soft px-2 py-0.5 rounded mb-3">
                              <Star size={12} strokeWidth={1.5} />
                              Recomendado
                            </p>
                          )}
                          <p className="text-sm text-fg-muted mb-3">
                            {sitio.tipoCocina} · {sitio.barrio}
                          </p>
                          <p className="text-sm text-fg leading-relaxed mb-4">
                            {sitio.descripcion}
                          </p>
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
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "rutas" && (
        <div
          id={panelId("rutas")}
          role="tabpanel"
          aria-labelledby="gastronomia-tab-rutas"
        >
          {ensaladilla && <EnsaladillaDetalle campeonato={ensaladilla} />}
          <PintxoPoteInfo />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {rutas.map((ruta, index) => (
              <InViewWrapper key={ruta.slug} delay={Math.min(index * 0.04, 0.4)}>
                <article className="double-bezel rounded-2xl p-5 h-full">
                  <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-amber mb-2">
                    {ruta.zona}
                  </p>
                  <h2 className="font-display text-lg font-semibold text-fg mb-1 leading-tight">
                    {ruta.nombre}
                  </h2>
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
        </div>
      )}

      {tab === "agenda" && (
        <div
          id={panelId("agenda")}
          role="tabpanel"
          aria-labelledby="gastronomia-tab-agenda"
        >
          {eventos.length === 0 ? (
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
                      href={`/evento/${ev.slug}`}
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
          )}
        </div>
      )}
    </div>
  );
}
