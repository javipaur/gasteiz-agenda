"use client";

import { useSyncExternalStore } from "react";

/**
 * El cartel del atajo de buscar.
 *
 * Antes ponía `⌘K` fijo en los dos sitios donde aparece, y los dos manejan
 * `metaKey || ctrlKey` —o sea que en Windows y Linux el atajo funciona y el cartel
 * miente. `⌘` no existe ahí: quien lo lea no tiene ninguna tecla que pulsar.
 *
 * `navigator.platform` está obsoleto pero es lo único que funciona en los tres
 * navegadores sin pedir permisos; donde exista se lee `userAgentData.platform`,
 * que es lo que da la plataforma real y no la que el navegador finge.
 */
function esApple(): boolean {
  if (typeof navigator === "undefined") return true;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const plataforma = nav.userAgentData?.platform ?? nav.platform ?? "";
  return /mac|iphone|ipad|ipod/i.test(plataforma);
}

/** El valor no cambia durante la vida de la página, así que no hay que suscribirse. */
const SIN_SUSCRIPCION = () => () => {};

export default function ShortcutHint({ className }: { className?: string }) {
  const apple = useSyncExternalStore(
    SIN_SUSCRIPCION,
    esApple,
    // En el servidor la plataforma es desconocida. Renderizar aquí lo que sea hace
    // que el primer render del cliente no coincida con el HTML y React tire el
    // árbol entero; `⌘K` es la apuesta razonable y se corrige al hidratar.
    () => true
  );

  return (
    <kbd className={className} aria-hidden="true">
      {apple ? "⌘K" : "Ctrl K"}
    </kbd>
  );
}