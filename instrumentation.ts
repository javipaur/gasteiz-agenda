import { logger } from "./lib/axiom/server";
import { createOnRequestError } from "@axiomhq/nextjs";

export const onRequestError = createOnRequestError(logger);

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  /*
   * Cada cosa tiene su propia puerta, y no una sola para todas.
   *
   * Estaba `if (ENABLE_PUSH_SCHEDULER !== "1") return` antes de arrancar nada, y
   * de ahí colgó después la poda de métricas. El efecto era que **apagar el push
   * apagaba también la poda**: sin push no hay digest, y sin digest tampoco
   * `lib/scheduler.ts` arrancaba, así que `podarSiToca()` no se llamaba nunca y la
   * tabla de eventos crecía para siempre. No se veía ningún error, porque no
   * fallaba nada: simplemente nadie pasaba por ahí.
   *
   * Y apagar el push es razonable: es una función opcional, y hay despliegues que
   * no quieren el digest. Una decisión sobre una función no puede silenciar
   * otra que crece sin límite en el mismo volumen.
   *
   * Cada `if` tiene su propio motivo escrito porque "por qué está esto aquí" es
   * la pregunta que se hace en la revisión, y con un solo motivo no la responde.
   */
  const push = process.env.ENABLE_PUSH_SCHEDULER === "1";
  const metricas = process.env.ENABLE_METRICAS !== "0";

  if (!push && !metricas) return;

  const { startScheduler } = await import("./lib/scheduler");
  startScheduler({ push, metricas });
}