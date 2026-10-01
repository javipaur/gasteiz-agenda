"use client";

import { useSyncExternalStore } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallOutcome = "accepted" | "dismissed" | "unavailable";

export type InstallStore = {
  subscribe: (alCambiar: () => void) => () => void;
  getAvailable: () => boolean;
  prompt: () => Promise<InstallOutcome>;
};

/**
 * El evento `beforeinstallprompt` se dispara **una vez por carga de página** y
 * `prompt()` lo consume. Eso significa que guardarlo más de lo necesario no es
 * inocuo: un segundo clic sobre un evento ya consumido hace que el navegador
 * rechace la llamada. Por eso `prompt()` lo descarta tanto si el usuario acepta
 * como si lo descarta, y por eso el estado se consume siempre.
 */
export function createInstallStore(target: EventTarget): InstallStore {
  let deferred: BeforeInstallPromptEvent | null = null;
  const suscriptores = new Set<() => void>();

  const avisar = () => suscriptores.forEach((fn) => fn());

  target.addEventListener(
    "beforeinstallprompt",
    ((evento: BeforeInstallPromptEvent) => {
      evento.preventDefault();
      deferred = evento;
      avisar();
    }) as EventListener
  );

  return {
    subscribe(alCambiar) {
      suscriptores.add(alCambiar);
      return () => {
        suscriptores.delete(alCambiar);
      };
    },
    getAvailable: () => deferred !== null,
    async prompt() {
      const evento = deferred;
      if (!evento) return "unavailable";
      // Se vacía antes de esperar, no después: entre el clic y la resolución de
      // `userChoice` no puede quedar un evento que otro clic reutilice.
      deferred = null;
      evento.prompt();
      const { outcome } = await evento.userChoice;
      avisar();
      return outcome;
    },
  };
}

const store: InstallStore | null =
  typeof window === "undefined" ? null : createInstallStore(window);

const SIN_STORE = () => false;
const SIN_SUSCRIPCION = () => () => {};

export function useInstallPrompt(): boolean {
  return useSyncExternalStore(
    store ? store.subscribe : SIN_SUSCRIPCION,
    store ? store.getAvailable : SIN_STORE,
    SIN_STORE
  );
}

export function promptInstall(): Promise<InstallOutcome> {
  return store ? store.prompt() : Promise.resolve("unavailable");
}