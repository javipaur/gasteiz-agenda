"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bus, TramFront, MapPin, Navigation, Search, X, Loader2 } from "lucide-react";
import FreshnessBadge from "./FreshnessBadge";

function horaActualMadrid(): string {
  return new Date().toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  });
}

type VgLinea = {
  id: string;
  nombre: string;
  codigo: string;
  grupo: string;
  color: string;
  esTranvia: boolean;
};

type VgResultado = {
  punto: { idParada: string; nombre: string; direccion?: string };
  lineas: VgLinea[];
  distanciaMetros?: number;
};

type VgLlegada = {
  line: string;
  destination: string;
  seconds: number;
  realtime: boolean;
  realTimeState: string;
  stopId: string;
  stopCount: number;
  vehiculo?: string;
  status?: string;
  caducada?: boolean;
};

type VgAlerta = {
  line?: string;
  stopId?: string;
  alertHeader: string;
  alertDescription?: string;
  alertPeriodStart: number;
  alertPeriodEnd: number;
  alertCause?: string;
  alertEffect?: string;
  alertUrl?: string;
};

type DetalleParada = {
  parada: { idParada: string; nombre: string; direccion?: string } | null;
  lineas: VgLinea[];
  llegadas: VgLlegada[];
  alertas: VgAlerta[];
  fetchedAt: number;
};

function minutosHasta(seconds: number): number {
  return Math.max(0, Math.round(seconds / 60));
}

function tiempoLlegada(llegada: VgLlegada): string {
  if (llegada.caducada || llegada.realTimeState === "CANCELED") return "Cancelado";
  const min = minutosHasta(llegada.seconds);
  if (min <= 1) return "Sale ya";
  return `${min} min`;
}

function LineaBadge({ linea, small = false }: { linea: VgLinea; small?: boolean }) {
  const isTram = linea.esTranvia || linea.codigo.toUpperCase().startsWith("TG");
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-mono font-semibold ${
        small ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1"
      } ${isTram ? "bg-teal/15 text-teal border border-teal/25" : "bg-accent/15 text-accent border border-accent/25"}`}
      title={linea.nombre}
    >
      {isTram ? <TramFront size={small ? 10 : 12} aria-hidden="true" /> : <Bus size={small ? 10 : 12} aria-hidden="true" />}
      {linea.codigo}
    </span>
  );
}

function AlertaAlert({ alerta }: { alerta: VgAlerta }) {
  const tieneDetalle = alerta.alertDescription || alerta.alertCause || alerta.alertEffect;
  return (
    <div className="rounded-xl border border-amber/25 bg-amber/10 px-4 py-3">
      <div className="flex items-start gap-2">
        <span aria-hidden="true" className="mt-0.5 text-amber">⚠</span>
        <div>
          <p className="text-sm font-semibold text-fg">
            {alerta.line && alerta.line !== "*" ? (
              <>
                <span className="font-mono text-xs text-amber mr-1.5">L{alerta.line}</span>
                {alerta.alertHeader}
              </>
            ) : (
              alerta.alertHeader
            )}
          </p>
          {tieneDetalle && (
            <p className="text-xs text-fg-muted mt-1 leading-relaxed">
              {alerta.alertDescription || alerta.alertCause || alerta.alertEffect}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BusPageClient() {
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<VgResultado[] | null>(null);
  const [buenResultado, setBuenResultado] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [buscado, setBuscado] = useState(false);
  const [detalle, setDetalle] = useState<DetalleParada | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [error, setError] = useState("");
  const [geoState, setGeoState] = useState<"idle" | "buscando" | "error">("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refrescoRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idParadaActiva = useRef<string | null>(null);

  const fetchResultados = useCallback(async (texto: string) => {
    setBuscando(true);
    setError("");
    try {
      const res = await fetch(`/api/vgbus?accion=buscar&buscar=${encodeURIComponent(texto)}`);
      if (!res.ok) throw new Error("err");
      const json = await res.json();
      setResultados(json.resultado || []);
      setBuenResultado((json.resultado || []).length > 0);
      setBuscado(true);
      setDetalle(null);
      idParadaActiva.current = null;
    } catch {
      setResultados([]);
      setBuenResultado(false);
      setBuscado(true);
      setError("No se pudo contactar con el servicio de transporte.");
    } finally {
      setBuscando(false);
    }
  }, []);

  const cargarDetalle = useCallback(async (idParada: string) => {
    if (!idParada) return;
    idParadaActiva.current = idParada;
    setCargandoDetalle(true);
    setError("");
    const fetchDetalle = async () => {
      try {
        const res = await fetch(`/api/vgbus?accion=detalle&idParada=${encodeURIComponent(idParada)}`);
        if (!res.ok) throw new Error("err");
        const json = await res.json();
        // ignorar actualizaciones de paradas que ya no están seleccionadas
        if (idParadaActiva.current === idParada) setDetalle(json);
      } catch {
        if (idParadaActiva.current === idParada) setError("No se pudieron cargar las llegadas. Inténtalo de nuevo.");
      } finally {
        setCargandoDetalle(false);
      }
    };
    await fetchDetalle();
  }, []);

  const seleccionarParada = useCallback(
    (res: VgResultado) => {
      cargarDetalle(res.punto.idParada);
      setQuery("");
    },
    [cargarDetalle]
  );

  const volver = useCallback(() => {
    setDetalle(null);
    setQuery("");
    setResultados(null);
    setBuscado(false);
    idParadaActiva.current = null;
    setBuscando(false);
  }, []);

  // limpiar intervalos al desmontar
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (refrescoRef.current) clearInterval(refrescoRef.current);
    };
  }, []);

  // auto-refresco de llegadas cada 30 s mientras haya detalle
  useEffect(() => {
    if (refrescoRef.current) clearInterval(refrescoRef.current);
    if (detalle && detalle.parada) {
      refrescoRef.current = setInterval(() => {
        cargarDetalle(detalle.parada!.idParada);
      }, 30000);
    } else {
      refrescoRef.current = null;
    }
    return () => {
      if (refrescoRef.current) clearInterval(refrescoRef.current);
    };
  }, [detalle, cargarDetalle]);

  const onChangeQuery = useCallback(
    (texto: string) => {
      setQuery(texto);
      setDetalle(null);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const limpio = texto.trim();
      if (limpio.length < 2) {
        setResultados(null);
        setBuscado(false);
        return;
      }
      debounceRef.current = setTimeout(() => fetchResultados(limpio), 450);
    },
    [fetchResultados]
  );

  const buscarCerca = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoState("error");
      return;
    }
    setGeoState("buscando");
    setError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(`/api/vgbus?accion=cerca&lat=${latitude}&lng=${longitude}&radio=300`);
          if (!res.ok) throw new Error("err");
          const json = await res.json();
          setResultados(json.resultado || []);
          setBuenResultado((json.resultado || []).length > 0);
          setBuscado(true);
          setDetalle(null);
          setGeoState("idle");
        } catch {
          setGeoState("error");
          setError("No se pudieron obtener las paradas cercanas.");
        }
      },
      () => {
        setGeoState("error");
        setError("No se pudo acceder a tu ubicación. Activa los permisos o busca por nombre.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  const llegadas = detalle?.llegadas || [];
  const alertas = detalle?.alertas || [];
  const lineasParada = detalle?.lineas || [];

  return (
    <div className="px-5 sm:px-6 max-w-4xl mx-auto pt-28 pb-32">
      <p className="inline-flex items-center gap-2 mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-fg-subtle">
        <Bus size={13} aria-hidden="true" /> TUVISA · Tranvía
      </p>
      <h1 className="font-display text-4xl md:text-5xl text-fg mb-3 tracking-[-0.02em]">
        {detalle && detalle.parada ? detalle.parada.nombre : "Autobús y tranvía"}
      </h1>
      <p className="text-fg-muted max-w-xl mb-8">
        {detalle && detalle.parada
          ? `Parada ${detalle.parada.idParada} · próximas llegadas en tiempo real`
          : "Busca una parada por nombre o usa tu ubicación para ver cuándo llegan las próximas unidades."}
      </p>

      {!detalle ? (
        <>
          <form
            className="relative mb-4"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              const limpio = query.trim();
              if (limpio.length >= 2) {
                if (debounceRef.current) clearTimeout(debounceRef.current);
                fetchResultados(limpio);
              }
            }}
          >
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => onChangeQuery(e.target.value)}
              placeholder="Ej. Catedral, Florida, Europa…"
              className="w-full h-13 pl-11 pr-10 rounded-2xl bg-surface border border-border text-fg placeholder:text-fg-muted focus:outline-2 focus:outline-accent focus:border-accent/40 transition-all duration-300 text-base py-3"
              aria-label="Buscar parada"
              inputMode="search"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setResultados(null);
                  setBuscado(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 grid size-7 place-items-center rounded-full text-fg-subtle hover:text-fg hover:bg-bg-muted transition-colors duration-300 cursor-pointer"
                aria-label="Limpiar búsqueda"
              >
                <X size={14} />
              </button>
            )}
          </form>

          <button
            onClick={buscarCerca}
            disabled={geoState === "buscando"}
            className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-accent hover:text-accent-hover transition-colors duration-300 cursor-pointer disabled:opacity-50"
          >
            {geoState === "buscando" ? (
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            ) : (
              <Navigation size={15} aria-hidden="true" />
            )}
            {geoState === "buscando" ? "Localizando paradas…" : "Paradas cerca de mí"}
          </button>

          {buscando && !resultados && (
            <div className="flex items-center gap-3 text-fg-muted text-sm py-4" role="status">
              <Loader2 size={16} className="animate-spin text-accent" aria-hidden="true" />
              Buscando paradas…
            </div>
          )}

          {error && (
            <p className="text-sm text-red-500 bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3 mb-4" role="alert">
              {error}
            </p>
          )}

          {buscado && !buscando && resultados && (
            <>
              <p className="text-sm text-fg-subtle mb-3 tabular-nums">
                {resultados.length > 0
                  ? `${resultados.length} parada${resultados.length !== 1 ? "s" : ""} encontrada${resultados.length !== 1 ? "s" : ""}`
                  : "Sin resultados"}
              </p>

              {!buenResultado && (
                <p className="text-fg-muted text-sm mb-4">
                  No encontramos paradas con ese nombre. Prueba con otro texto o usa las paradas cerca de ti.
                </p>
              )}

              <ul className="space-y-3">
                {resultados.map((res) => (
                  <li key={res.punto.idParada}>
                    <button
                      onClick={() => seleccionarParada(res)}
                      className="w-full text-left rounded-2xl border border-border bg-surface p-4 hover:border-accent/30 hover:shadow-md hover:shadow-accent/5 transition-all duration-300 cursor-pointer active:scale-[0.99]"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <span className="flex items-center gap-2 mb-1">
                            <span className="text-fg-subtle text-xs font-mono">#{res.punto.idParada}</span>
                            {res.distanciaMetros !== undefined && (
                              <span className="inline-flex items-center gap-1 text-xs text-fg-muted">
                                <MapPin size={11} aria-hidden="true" />
                                {res.distanciaMetros} m
                              </span>
                            )}
                          </span>
                          <h3 className="font-display text-base font-semibold text-fg">{res.punto.nombre}</h3>
                          {res.punto.direccion && (
                            <p className="text-xs text-fg-muted mt-0.5">{res.punto.direccion}</p>
                          )}
                        </div>
                        <span className="shrink-0 text-fg-subtle transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden="true">
                          →
                        </span>
                      </div>
                      {res.lineas.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {res.lineas.slice(0, 12).map((l) => (
                            <LineaBadge key={l.codigo} linea={l} small />
                          ))}
                        </div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      ) : (
        <div>
          <button
            onClick={volver}
            className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:text-accent-hover transition-colors duration-300 cursor-pointer"
          >
            <span aria-hidden="true">←</span> Volver a buscar
          </button>

          {alertas.length > 0 && (
            <div className="space-y-2 mb-5">
              {alertas.map((a, i) => (
                <AlertaAlert key={i} alerta={a} />
              ))}
            </div>
          )}

          {lineasParada.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-5">
              {lineasParada.map((l) => (
                <LineaBadge key={l.codigo} linea={l} />
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <p className="text-xs text-fg-subtle tabular-nums uppercase tracking-[0.15em]">
              Próximas llegadas · <span className="normal-case">ahora son las {horaActualMadrid()}</span>
            </p>
            {detalle?.fetchedAt ? <FreshnessBadge since={detalle.fetchedAt} /> : null}
          </div>

          {cargandoDetalle && llegadas.length === 0 && (
            <div className="flex items-center gap-3 text-fg-muted text-sm py-6" role="status">
              <Loader2 size={16} className="animate-spin text-accent" aria-hidden="true" />
              Consultando llegadas…
            </div>
          )}

          {llegadas.length > 0 && (
            <div>
              {(["realtime", "scheduled"] as const).map((tipo) => {
                const grupo = llegadas.filter((l) =>
                  tipo === "realtime" ? l.realtime : !l.realtime
                );
                if ((tipo === "scheduled" && grupo.length === 0) || (tipo === "realtime" && grupo.length === 0)) return null;
                return (
                  <section key={tipo} className="mb-5">
                    <p className="text-sm font-semibold text-fg mb-2">
                      {tipo === "realtime" ? "Tiempo real" : "Horario programado"}
                    </p>
                    <ul className="rounded-2xl border border-border bg-surface divide-y divide-border">
                      {grupo.map((l, i) => (
                        <li
                          key={`${l.line}-${l.seconds}-${i}`}
                          className={`flex items-center gap-3 px-4 py-3 ${
                            l.caducada ? "opacity-50" : ""
                          }`}
                        >
                          <span
                            className={`w-12 shrink-0 font-mono font-bold text-sm text-center rounded-md py-1 ${
                              l.line.startsWith("E") || l.line === "A"
                                ? "bg-green/15 text-green"
                                : "bg-accent/15 text-accent"
                            }`}
                          >
                            {l.line}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-fg truncate">{l.destination || "—"}</p>
                            {l.vehiculo && (
                              <p className="text-[11px] text-fg-muted tabular-nums">
                                Vehículo {l.vehiculo}
                                {l.stopCount ? ` · ${l.stopCount} paradas` : ""}
                              </p>
                            )}
                          </div>
                          {l.caducada ? (
                            <span className="shrink-0 text-xs font-semibold text-red-500">Cancelado</span>
                          ) : (
                            <span
                              className={`shrink-0 text-sm font-bold tabular-nums ${
                                minutosHasta(l.seconds) <= 1 ? "text-green" : "text-fg"
                              }`}
                            >
                              {tiempoLlegada(l)}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}

          {!cargandoDetalle && llegadas.length === 0 && !error && (
            <p className="text-fg-muted text-sm py-4">
              No hay llegadas previstas próximamente en esta parada.
            </p>
          )}

          <p className="text-[11px] text-fg-muted mt-3">
            Se actualiza cada ~30 s · Servicio ofrecido por TUVISA / Ayuntamiento de Vitoria-Gasteiz
          </p>
        </div>
      )}
    </div>
  );
}