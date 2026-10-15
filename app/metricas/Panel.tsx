"use client";

import { useState } from "react";

import { EVENTOS } from "@/lib/metricas";

/**
 * El panel: pide la clave, y con ella lee `/api/metric`.
 *
 * ## Por qué la clave se pide y no se guarda
 *
 * Porque guardarla en `localStorage` convertiría el panel en una página con la
 * puerta abierta en el momento en que alguien se aparte del teclado: cualquier
 * `XSS` —o un portátil compartido— se leería la clave sin pedirla. Está en el
 * estado del componente y se pierde al recargar, que es la única forma de que
 * "no está guardada" sea verdad y no una intención.
 *
 * ## Los estados que hay que distinguir
 *
 * `sin clave`, `cargando`, `mal`, `datos`. El `mal` se separa del `cargando`
 * porque son cosas opuestas: uno es "todavía no lo sabes" y el otro es "no va a
 * pasar nunca con esta clave", y meterlos en un solo `error` hace que un 401 y
 * un 503 se pinten igual, que es como se pierde un despliegue mal configurado.
 */

type Datos = {
  porEvento: Record<string, number>;
  total: number;
  primera: number | null;
  ultima: number | null;
  porRuta: {
    visitasPorRuta: Record<string, number>;
    instalacionPorRuta: Record<string, number>;
    sinRuta: number;
  };
};

/** Los rótulos de cada evento, que en la tabla salen como `snake_case`. */
const ROTULOS: Record<string, string> = {
  visita: "Visitas (pestañas)",
  instalada: "PWA instalada",
  instalacion_aceptada: "Aceptó el diálogo",
  instalacion_descartada: "Descartó el diálogo",
  instalacion_no_disponible: "El navegador no ofreció instalar",
};

function fecha(ms: number): string {
  // `Europe/Madrid` explícito, y no `toLocaleString()` a secas: el panel corre en
  // el contenedor, cuya zona es UTC si nadie puso `TZ`, y las fechas saldrían
  // desplazadas unas horas. Es el mismo motivo escrito en `lib/scheduler.ts`.
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ms));
}

function Porcentaje(n: number, total: number): string {
  if (total === 0) return "—";
  return `${((n / total) * 100).toFixed(1)} %`;
}

export default function Panel() {
  const [clave, setClave] = useState("");
  const [datos, setDatos] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function consultar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/metric", {
        headers: { "x-api-key": clave },
        cache: "no-store",
      });
      if (res.status === 401) {
        setError("La clave no es correcta.");
        setDatos(null);
        return;
      }
      if (res.status === 503) {
        setError("API_KEY no está definida en el servidor. El panel no puede abrirse.");
        setDatos(null);
        return;
      }
      if (!res.ok) {
        setError(`El servidor respondió ${res.status}.`);
        setDatos(null);
        return;
      }
      setDatos((await res.json()) as Datos);
    } catch {
      setError("No se pudo contactar con el servidor.");
      setDatos(null);
    } finally {
      setCargando(false);
    }
  }

  const visitas = datos?.porEvento.visita ?? 0;
  const instalada = datos?.porEvento.instalada ?? 0;

  return (
    <div>
      <form onSubmit={consultar} className="flex flex-col sm:flex-row gap-3 mb-10">
        <label htmlFor="clave" className="sr-only">
          Clave de la API
        </label>
        <input
          id="clave"
          type="password"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          placeholder="x-api-key"
          autoComplete="off"
          className="flex-1 min-h-[44px] px-4 rounded-lg bg-surface border border-border text-fg placeholder:text-fg-subtle focus:outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={cargando || clave.length === 0}
          className="inline-flex items-center justify-center min-h-[44px] px-6 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-all duration-300 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {cargando ? "Leyendo…" : "Leer"}
        </button>
      </form>

      {error && (
        <p
          role="alert"
          className="mb-8 px-4 py-3 rounded-lg bg-accent-subtle text-fg text-sm border border-border"
        >
          {error}
        </p>
      )}

      {!datos && !error && (
        <p className="text-fg-muted text-sm">
          Teclea la <code className="font-mono text-fg-muted">API_KEY</code> del
          servidor para leer los recuentos. No se guarda en el navegador.
        </p>
      )}

      {datos && (
        <div className="flex flex-col gap-10">
          <section>
            <h2 className="font-display text-lg font-semibold text-fg mb-4">
              Totales
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {EVENTOS.map((evento) => (
                <div
                  key={evento}
                  className="p-4 rounded-xl bg-surface border border-border"
                >
                  <p className="text-xs uppercase tracking-wider text-fg-subtle mb-2">
                    {ROTULOS[evento]}
                  </p>
                  <p className="font-display text-3xl font-bold text-fg">
                    {datos.porEvento[evento] ?? 0}
                  </p>
                  {evento !== "visita" && (
                    <p className="text-xs text-fg-subtle mt-1">
                      {Porcentaje(datos.porEvento[evento] ?? 0, visitas)} de visitas
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-fg mb-4">
              Embudo de instalación
            </h2>
            <div className="p-5 rounded-xl bg-surface border border-border">
              <p className="text-sm text-fg-muted mb-4">
                {visitas === 0 ? (
                  "Todavía no hay visitas que medir."
                ) : (
                  <>
                    De cada <strong className="text-fg">100</strong> pestañas
                    abiertas,{" "}
                    <strong className="text-fg">
                      {((instalada / visitas) * 100).toFixed(1)}
                    </strong>{" "}
                    dejan la PWA instalada. El resto son intenciones: el navegador
                    las emite al abrir el diálogo, y solo{" "}
                    <code className="font-mono">instalada</code> confirma que se
                    completó.
                  </>
                )}
              </p>
              <ol className="flex flex-col gap-2">
                {EVENTOS.filter((e) => e !== "visita").map((evento) => {
                  const n = datos.porEvento[evento] ?? 0;
                  return (
                    <li key={evento} className="flex items-center gap-3">
                      <span className="text-xs text-fg-muted w-44 shrink-0">
                        {ROTULOS[evento]}
                      </span>
                      <span className="flex-1 h-2 rounded-full bg-bg-elevated overflow-hidden">
                        <span
                          className="block h-full bg-accent rounded-full"
                          style={{ width: Porcentaje(n, visitas) }}
                        />
                      </span>
                      <span className="text-xs font-mono text-fg-muted w-12 text-right">
                        {n}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-fg mb-4">
              Por ruta
            </h2>
            {Object.keys(datos.porRuta.visitasPorRuta).length === 0 ? (
              <p className="text-sm text-fg-muted">
                Todavía no hay visitas con ruta. Suele significar que la tabla se
                creó antes de la migración que añadió la columna.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-fg-subtle border-b border-border">
                      <th className="pb-2 pr-4 font-medium">Ruta</th>
                      <th className="pb-2 pr-4 font-medium text-right">Visitas</th>
                      <th className="pb-2 pr-4 font-medium text-right">Instaladas</th>
                      <th className="pb-2 font-medium text-right">Tasa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(datos.porRuta.visitasPorRuta)
                      .sort((a, b) => b[1] - a[1])
                      .map(([ruta, n]) => {
                        const inst =
                          datos.porRuta.instalacionPorRuta[ruta] ?? 0;
                        return (
                          <tr key={ruta} className="border-b border-border/50">
                            <td className="py-2 pr-4 font-mono text-fg">{ruta}</td>
                            <td className="py-2 pr-4 text-right text-fg-muted">{n}</td>
                            <td className="py-2 pr-4 text-right text-fg-muted">{inst}</td>
                            <td className="py-2 text-right text-fg">{Porcentaje(inst, n)}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
            {datos.porRuta.sinRuta > 0 && (
              <p className="text-xs text-fg-subtle mt-3">
                {datos.porRuta.sinRuta} evento
                {datos.porRuta.sinRuta === 1 ? "" : "s"} sin ruta: anteriores a la
                migración que añadió la columna, o de pestañas donde
                `sessionStorage` no estaba disponible.
              </p>
            )}
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold text-fg mb-4">
              Ventana medida
            </h2>
            <p className="text-sm text-fg-muted">
              {datos.primera === null ? (
                "Sin eventos todavía."
              ) : (
                <>
                  Desde <span className="text-fg">{fecha(datos.primera)}</span>{" "}
                  hasta{" "}
                  <span className="text-fg">{fecha(datos.ultima ?? datos.primera)}</span>
                  . La poda borra lo que pase de 400 días.
                </>
              )}
            </p>
          </section>
        </div>
      )}
    </div>
  );
}