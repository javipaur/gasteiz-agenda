import { logger } from "./lib/axiom/server";
import { createOnRequestError } from "@axiomhq/nextjs";

export const onRequestError = createOnRequestError(logger);

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.ENABLE_PUSH_SCHEDULER !== "1") return;

  const { startScheduler } = await import("./lib/scheduler");
  startScheduler();
}