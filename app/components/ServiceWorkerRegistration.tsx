"use client";

import { useEffect } from "react";

/**
 * Registra el service worker — **solo en producción**.
 *
 * ## Por qué no en desarrollo
 *
 * Porque `public/sw.js` sirve `/_next/static/` **cache-first**, y eso está bien
 * en producción —los chunks llevan el hash del contenido en el nombre, así que
 * una URL es siempre el mismo contenido— pero en desarrollo **no**: Turbopack
 * genera nombres estables para los chunks, así que la misma URL puede servir
 * código distinto según el momento.
 *
 * Con el service worker registrado, el navegador se queda con el primer bundle
 * que vio y **sirve ese para siempre**. El síntoma es desconcertante: se cambia
 * un componente, se recarga, y el navegador enseña la versión anterior. Se
 * parece mucho a "el HMR no funciona" y se pierde bastante tiempo hasta que se
 * sospecha del service worker.
 *
 * La cura es la de siempre: **desregistrarlo y borrar las cachés**, y a partir
 * ahí todo va bien. Pero eso hay que hacerlo a mano, cada vez, y con razón de
 * peso no se va a arreglar: en desarrollo el service worker no aporta nada —la
 * caché offline y la instalabilidad son cosas de producción— y solo estorba.
 *
 * Y no es hipotético: esto pasó de verdad. Un cambio en `lib/shared.tsx` no se
 * veía, mientras que otro en `lib/categories.ts` sí, porque eran chunks
 * distintos con distinto estado de caché. Parecía un fallo de compilación y era
 * una caché.
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "activated") {
                if (document.visibilityState === "visible") {
                  window.location.reload();
                }
              }
            });
          }
        });
      })
      .catch(() => {});
  }, []);

  return null;
}
