"use client";

import { Logger, SimpleFetchTransport, ConsoleTransport } from "@axiomhq/logging";
import { createUseLogger, createWebVitalsComponent } from "@axiomhq/react";

export const clientLogger = new Logger({
  transports: [
    new SimpleFetchTransport({
      input: "/api/log",
      autoFlush: { durationMs: 3000 },
    }),
    new ConsoleTransport(),
  ],
});

const useLogger = createUseLogger(clientLogger);
const WebVitals = createWebVitalsComponent(clientLogger);

export { useLogger, WebVitals };