"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { Phone, MapPin, Clock, Loader2, RefreshCw } from "lucide-react";
import FreshnessBadge from "./FreshnessBadge";
import type { FarmaciaGuardia } from "@/lib/sources/farmacias";

// El Leaflet sólo se carga en el cliente (window)
const MapaFarmacias = dynamic(
  () => import("./FarmaciasMap"),
  { ssr: false, loading: () => <MapSkeleton /> }
);

function MapSkeleton() {
  return (
    <div className="h-full min-h-[360px] rounded-2xl border border-border bg-surface animate-pulse grid place-items-center">
      <Loader2 size={20} className="animate-spin text-fg-subtle" aria-hidden="true" />
    </div>
  );
}

function FechaDebito({ iso }: { iso: string }) {
  const [y, m, d] = iso.split("-").map(Number);
  const fecha = new Date(y, m - 1, d);
  if (isNaN(fecha.getTime())) return <>{iso}</>;
  // El mes se saca con `Intl` y no con `formatDate` a propósito, por dos razones.
  // Una: `formatDate` devuelve `{ day, month }`, no una cadena, y usado como hijo
  // hace que React lance "Objects are not valid as a React child" — con lo que
  // `/farmacias` caía en el error boundary en cuanto la API devolvía una fecha,
  // que es justo cuando hay algo que enseñar. Dos: `new Date("2026-10-03")` es
  // medianoche **UTC** por norma, así que en cualquier huso negativo `formatDate`
  // habría enseñado el día anterior.
  const mes = new Intl.DateTimeFormat("es", { month: "short" })
    .format(fecha)
    .toUpperCase()
    .replace(".", "");
  return <>{`${fecha.getDate()} ${mes}`}</>;
}

export default function FarmaciasPageClient({ ahora }: { ahora: number }) {
  const [farmacias, setFarmacias] = useState<FarmaciaGuardia[]>([]);
  const [fecha, setFecha] = useState("");
  const [fetchedAt, setFetchedAt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const inViewRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError("");
    try {
      const res = await fetch("/api/farmacias", { next: { revalidate: 3600 } });
      if (!res.ok) throw new Error("err");
      const json = await res.json();
      setFarmacias(json.data || []);
      setFecha(json.date || "");
      setFetchedAt(json.fetchedAt || Date.now());
      setError("");
    } catch {
      setError("No se pudieron cargar las farmacias de guardia. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (inView) load();
  }, [inView, load]);

  useEffect(() => {
    const el = inViewRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const conCoords = useMemo(
    () => farmacias.filter((f) => f.lat && f.lng),
    [farmacias]
  );

  const hoy = useMemo(() => {
    // El reloj venía de `new Date()` dentro del memo con deps `[]`, o sea que
    // "hoy" se calculaba una vez al montar y no volvía a cambiar nunca: la
    // guardia se quedaba en el día que se abrió la página. Llega como prop por
    // el mismo motivo que en `HeroSection` y `NextDaysSection`.
    const d = new Date(ahora);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, [ahora]);

  const seleccionada = farmacias.find((f) => f.id === selectedId) || null;

  return (
    <div className="px-5 sm:px-6 max-w-6xl mx-auto pt-28 pb-32">
      <p className="inline-flex items-center gap-2 mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-fg-subtle">
        <MapPin size={13} aria-hidden="true" /> Farmacias de Vitoria-Gasteiz
      </p>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <h1 className="font-display text-4xl md:text-5xl text-fg tracking-[-0.02em]">
          Farmacias abiertas hoy
        </h1>
        {fetchedAt > 0 && <FreshnessBadge since={fetchedAt} />}
      </div>
      <p className="text-fg-muted max-w-xl mb-8">
        Directorio de farmacias de Vitoria-Gasteiz con dirección y teléfono. Pulsa
        el teléfono para llamar directamente.
        <span className="block mt-2 text-fg-subtle">
          No es el cuadrante de guardia: el Colegio de Farmacéuticos de Álava
          bloquea el acceso automatizado a su listado, así que no se puede saber
          cuál está de turno. Para eso, llama al Colegio.
        </span>
      </p>

      {error && (
        <p className="text-sm text-danger bg-danger/5 border border-danger/20 rounded-xl px-4 py-3 mb-5" role="alert">
          {error}
          <button onClick={load} className="ml-3 underline font-medium cursor-pointer">
            Reintentar
          </button>
        </p>
      )}

      <div ref={inViewRef} className="grid lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-border bg-surface overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="font-display text-base font-semibold text-fg flex items-center gap-2">
                <MapPin size={15} className="text-accent" aria-hidden="true" />
                Mapa
              </h2>
              <button
                onClick={load}
                disabled={refreshing || loading}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-fg-muted hover:text-fg transition-colors duration-300 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} aria-hidden="true" />
                Actualizar
              </button>
            </div>
            <div className="h-[400px] md:h-[480px]">
              {loading ? (
                <MapSkeleton />
              ) : conCoords.length > 0 ? (
                <MapaFarmacias
                  farmacias={conCoords}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              ) : (
                <div className="h-full grid place-items-center text-fg-muted text-sm">
                  Sin coordenadas disponibles para las farmacias de hoy.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-base font-semibold text-fg">
              {farmacias.length} farmacia{farmacias.length !== 1 ? "s" : ""} en Vitoria-Gasteiz
            </h2>
            {fecha === hoy && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green/15 text-green border border-green/25 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-green opacity-60 animate-ping" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-green" />
                </span>
                Actualizado
              </span>
            )}
          </div>

          {farmacias.length === 0 && !loading ? (
            <p className="text-fg-muted text-sm">
              No se han podido cargar las farmacias. Inténtalo de nuevo.
            </p>
          ) : (
            <ul className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {farmacias.map((f) => (
                <li
                  key={f.id}
                  className={`rounded-2xl border transition-all duration-300 ${
                    selectedId === f.id
                      ? "border-accent/40 bg-accent-subtle/30 shadow-md shadow-accent/10"
                      : "border-border bg-surface hover:border-accent/25 hover:shadow-md hover:shadow-accent/5"
                  }`}
                >
                  {/*
                    El botón selecciona y el teléfono es un `<a>` hermano, no un hijo.
                    El contenido de un `button` no puede ser interactivo: con el
                    enlace dentro, el HTML era inválido y hacía falta un
                    `stopPropagation` en el `onClick` del `<a>` para que no se
                    seleccionara la farmacia. Sin anidado no hace falta, y el enlace
                    vuelve a ser un enlace.
                  */}
                  <button
                    onClick={() => setSelectedId(f.id === selectedId ? null : f.id)}
                    aria-pressed={selectedId === f.id}
                    className="w-full text-left p-4 cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-display text-sm font-semibold text-fg">{f.name}</h3>
                      {selectedId === f.id && (
                        <span className="shrink-0 text-accent" aria-hidden="true">
                          <MapPin size={14} />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-fg-muted">
                      {f.shortAddress || f.address || f.neighborhood}
                    </p>
                  </button>

                  {(f.horarios && f.horarios !== "-") || f.phone ? (
                    <div className="px-4 pb-4 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                      {f.horarios && f.horarios !== "-" && (
                        <span className="inline-flex items-center gap-1 text-xs text-fg-muted">
                          <Clock size={12} aria-hidden="true" />
                          {f.horarios}
                        </span>
                      )}
                      {f.phone && (
                        <a
                          href={`tel:${f.phone.replace(/[^\d+]/g, "")}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:text-accent-hover transition-colors duration-300"
                        >
                          <Phone size={12} aria-hidden="true" />
                          {f.phone}
                        </a>
                      )}
                    </div>
                  ) : null}

                  {f.lat && f.lng && (
                    <p className="mt-2 px-4 pb-4 text-[10px] text-fg-muted tabular-nums hidden">
                      {f.lat}, {f.lng}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {seleccionada && (
        <div className="mt-5 rounded-2xl border border-accent/25 bg-accent-subtle/20 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-accent/10 text-accent border border-accent/20">
              <MapPin size={16} aria-hidden="true" />
            </span>
            <div>
              <p className="font-display text-sm font-semibold text-fg">{seleccionada.name}</p>
              <p className="text-xs text-fg-muted">
                {seleccionada.shortAddress || seleccionada.address} ·{" "}
                {seleccionada.horarios !== "-" && seleccionada.horarios ? `${seleccionada.horarios} · ` : ""}
                {seleccionada.phone && (
                  <a href={`tel:${seleccionada.phone.replace(/[^\d+]/g, "")}`} className="text-accent font-medium">
                    {seleccionada.phone}
                  </a>
                )}
              </p>
            </div>
          </div>
          {seleccionada.lat && seleccionada.lng && (
            <a
              href={`https://www.google.com/maps?q=${seleccionada.lat},${seleccionada.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:text-accent-hover transition-colors duration-300"
            >
              Ver en Google Maps
              <span aria-hidden="true">↗</span>
            </a>
          )}
        </div>
      )}

      <p className="mt-6 text-[11px] text-fg-muted">
        Fuente: Open Data Euskadi, Gobierno Vasco — «Farmacias y botiquines de Euskadi»
        (CC BY, actualización mensual). No incluye el turno de guardia.
        <br />
        <FechaDebito iso={fecha} />
      </p>
    </div>
  );
}