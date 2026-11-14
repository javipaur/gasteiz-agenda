/**
 * Señal de que una fuente ha servido datos de respaldo (caché interna/stale)
 * porque la lectura actual falló, pero no ha podido completarse de forma sana.
 *
 * **Por qué existe.** Tres scrapers mantienen caché propia y, ante un fallo de
 * red o de forma, devuelven la última respuesta buena para no vaciar secciones.
 * Eso es resiliencia correcta para quien consume los datos, pero no es una
 * lectura sana: si el agregador la cuenta como sana, el ledger de ausencias
 * interpreta "seguimos viendo estos eventos" cuando en realidad nadie pudo
 * confirmar nada en esta importación.
 *
 * **Contrato.** En modo estricto (usado por el agregador/ledger) el scraper
 * lanza este error llevando los datos de respaldo. El agregador los sirve, pero
 * registra la fuente como fallida/degradada. En modo no estricto (llamadas
 * directas desde rutas/páginas que necesitan resiliencia) el scraper devuelve
 * los datos normalmente.
 */
export class DegradedSourceReadError extends Error {
  readonly staleData: unknown[];
  readonly cause: unknown;

  constructor(source: string, cause: unknown, staleData: unknown[]) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    super(`[${source}] lectura degradada (caché interna): ${reason}`);
    this.name = "DegradedSourceReadError";
    this.staleData = staleData;
    this.cause = cause;
  }
}

/** Contexto opcional de ejecución de una fuente. */
export type SourceRunContext = {
  /**
   * Cuando es `true`, una lectura que solo puede resolverse con datos de
   * respaldo (stale) debe lanzar `DegradedSourceReadError` en vez de devolverlos
   * como éxito, para que el llamador pueda distinguir "sano" de "degradado".
   */
  strict?: boolean;
};

export function isDegradedSourceReadError(error: unknown): error is DegradedSourceReadError {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: string }).name === "DegradedSourceReadError" &&
    Array.isArray((error as { staleData?: unknown }).staleData)
  );
}