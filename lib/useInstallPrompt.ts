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

/**
 * "¿Está ya en la pantalla de inicio?", que es una pregunta distinta de "¿el
 * navegador me deja instalar?".
 *
 * Se separa porque las dos se responden por mecanismos que no se parecen: el
 * evento `beforeinstallprompt` es de Chromium, y `display-mode` existe en
 * todos. Aplicar a `beforeinstallprompt` una comprobación de instalación solo
 * taparía el caso fácil —Chromium ya no dispara el evento para una PWA
 * instalada— y dejaría preguntando a iPhone, que es donde de verdad hace falta
 * saberlo.
 *
 * Estado propio y no un `useState` porque la respuesta puede cambiar sin que
 * nadie navegue: al volver de segundo plano con la PWA recién abierta, el
 * `matchMedia` cambia y con él lo que hay que pintar.
 */
export type InstaladoStore = {
  subscribe: (alCambiar: () => void) => () => void;
  getInstalado: () => boolean;
};

/**
 * Las dos piezas del DOM entran como argumentos y no se leen aquí dentro.
 * Es lo que permite probar el store en node con un `leer` falso, lo mismo que
 * `createInstallStore` se prueba sobre un `EventTarget` falso.
 */
export function createInstaladoStore(
  leer: () => boolean,
  suscribir: (alCambiar: () => void) => () => void
): InstaladoStore {
  const suscriptores = new Set<() => void>();

  return {
    subscribe(alCambiar) {
      const baja = suscribir(() => suscriptores.forEach((fn) => fn()));
      suscriptores.add(alCambiar);
      return () => {
        suscriptores.delete(alCambiar);
        baja();
      };
    },
    getInstalado: leer,
  };
}

/**
 * `navigator.standalone` es la API antigua de iOS en modo web app y sigue siendo
 * la que dice la verdad en un iPhone lanzado antes del modo standalone moderno.
 */
function leerInstalado(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

const instaladoStore: InstaladoStore | null =
  typeof window === "undefined"
    ? null
    : createInstaladoStore(leerInstalado, (alCambiar) => {
        const mq = window.matchMedia("(display-mode: standalone)");
        mq.addEventListener("change", alCambiar);
        return () => mq.removeEventListener("change", alCambiar);
      });

const NO_INSTALADO = () => false;

export function useInstalado(): boolean {
  return useSyncExternalStore(
    instaladoStore ? instaladoStore.subscribe : SIN_SUSCRIPCION,
    instaladoStore ? instaladoStore.getInstalado : NO_INSTALADO,
    NO_INSTALADO
  );
}