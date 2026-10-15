"use client";

import { useEffect } from "react";

import { useInstalado, alResultado } from "@/lib/useInstallPrompt";
import type { Evento } from "@/lib/metricas";

/**
 * El contador de uso, en un componente que no pinta nada.
 *
 * ## Por qué vive aquí y no en el servidor
 *
 * Porque lo que quiere contar son **dos cosas que el servidor no puede ver**. Cuánta
 * gente entra, y sobre todo cuántas instala, que se responde leyendo
 * `display-mode: standalone`: si el navegador dice que va en standalone, la PWA
 * está instalada, y eso no viaja en ninguna petición. El servidor ve un `GET /` de
 * una PWA instalada y el mismo `GET /` de una pestaña de Chrome, y para él son la
 * misma línea de log.
 *
 * Por eso los eventos salen del navegador y no de un middleware.
 *
 * ## Por qué no hay cookies
 *
 * Porque `CookieConsent.tsx` existe para que este sitio no tenga tracking, y pedir
 * una cookie para "saber cuántos sois" rompe el trato sin comprar nada que no se
 * pueda sacar de los logs. `visita` cuenta pestañas, no personas: quien quiera
 * únicos los tiene que cruzar en el panel, no se le pide permiso al visitante.
 */

/**
 * Manda un evento y se traga el fallo.
 *
 * Un contador no puede ser la razón de que la web no cargue: si el `fetch` falla
 * porque no hay red, el `catch` se come el error y la página sigue. Y no se
 * reintenta, porque reintentar sobre una visita ya contada la contaría dos veces,
 * y un número que se lee en un panel y miente es peor que no tenerlo.
 */
function enviar(evento: Evento, ruta?: string): void {
  try {
    void fetch("/api/metric", {
      method: "POST",
      headers: { "content-type": "application/json" },
      // El reloj del navegador, que es el que vio la persona. El de un contenedor
      // en Dokploy puede ir desviado, y un contador cuyo orden depende del reloj
      // de la máquina no sirve para nada.
      body: JSON.stringify({ evento, ts: Date.now(), ruta }),
      // Para que el navegador pueda mandar el evento aunque cierre la pestaña
      // justo después, que es cuando pasa con `instalada`.
      keepalive: true,
    }).catch(() => {
      // Sin red, o con el navegador ya cerrando. Nada que hacer.
    });
  } catch {
    // El `try` cubre también un `JSON.stringify` que fallara, que aquí no puede,
    // pero hace el `enviar` imposible que rompa a quien lo llama.
  }
}

/**
 * De dónde vino la persona, en el sentido de "qué página tenía abierta cuando
 * decidió instalar".
 *
 * Y por eso va en `sessionStorage` y no se lee de `location` en cada evento: sin
 * identificar a la persona entre páginas, cada evento solo sabe dónde **está**
 * ahora. Con esta ruta inicial se puede responder "¿la gente instala desde la home
 * o desde `/instalar`?", que es la pregunta que decide dónde va el botón.
 *
 * Y es la misma memoria de pestaña que la visita, por lo mismo: no viaja, no la ve
 * el servidor y no pide consentimiento.
 */
const CLAVE_ORIGEN = "gc:origen";

function fijarOrigen(): string {
  const ruta = window.location.pathname;
  try {
    const guardado = window.sessionStorage.getItem(CLAVE_ORIGEN);
    if (guardado) return guardado;
    window.sessionStorage.setItem(CLAVE_ORIGEN, ruta);
  } catch {
    // Sin `sessionStorage` se usa la ruta actual, que es una aproximación
    // razonable: solo importa cuando alguien navega antes de instalar.
  }
  return ruta;
}

/**
 * `sessionStorage` es lo que hace que `visita` cuente una vez por pestaña y no
 * una por recarga.
 *
 * Y es memoria de la pestaña, no una cookie: no viaja, no la ve el servidor, no
 * pide consentimiento y desaparece al cerrar. El coste es que no sobrevive a un
 * crash del navegador ni se comparte entre pestañas, que para "cuántas veces se
 * ha abierto esto" es exactamente lo que se quiere.
 */
const CLAVE_VISITA = "gc:visitado";

function yaVisitado(): boolean {
  try {
    if (window.sessionStorage.getItem(CLAVE_VISITA) === "1") return true;
    window.sessionStorage.setItem(CLAVE_VISITA, "1");
    return false;
  } catch {
    // Sin `sessionStorage` —modo privado en algunos navegadores— se cuenta
    // siempre. Es un contador al alza, que es el lado que no miente hacia abajo.
    return false;
  }
}

export default function Metricas() {
  const instalado = useInstalado();

  /* Una visita por pestaña, y solo la primera. */
  useEffect(() => {
    if (!yaVisitado()) enviar("visita", fijarOrigen());
  }, []);

  /*
   * La instalación, en cuanto se sepa.
   *
   * El `[]` a propósito, igual que en `lib/useInstallPrompt.ts`: el valor tiene
   * que leerse **una vez al montar**, no en cada cambio. Si se leyera en cada
   * cambio, volver de segundo plano con la PWA abierta — que es justo cuando el
   * `matchMedia` cambia— contaría una instalación por cada vuelta al foreground,
   * y el contador se multiplicaría sin que nadie instalara nada.
   */
  useEffect(() => {
    if (instalado) enviar("instalada", fijarOrigen());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * El resultado del diálogo, que es lo que separa "el botón no se ve" de "el
   * diálogo asusta". Los tres eventos son intenciones, no instalaciones: la
   * única que confirma es `instalada`.
   */
  useEffect(
    () =>
      alResultado((outcome) => {
        if (outcome === "accepted") enviar("instalacion_aceptada");
        else if (outcome === "dismissed") enviar("instalacion_descartada");
        else enviar("instalacion_no_disponible");
      }),
    []
  );

  return null;
}