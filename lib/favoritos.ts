import { localDateKey } from "./slug";

/**
 * Separar los favoritos en los que vienen y los que ya no.
 *
 * Vive aquí y no en `app/favoritos/page.tsx` por dos razones. La primera es que la
 * comparación tiene que ser **por día local**, y el día local ya tiene una sola
 * definición en el repo: `localDateKey` de `lib/slug.ts`, la misma que usa la clave
 * de dedupe de `lib/agenda.ts` y la que usa el slug. Si esta página comparara con
 * `new Date(a.date) < new Date()` por su cuenta, un favorito de un evento de las
 * 00:30 de Madrid se contaría como pasado o como futuro según el día, que es
 * exactamente la clase de desajuste que `__tests__/huso.test.ts` existe para
 * cazar.
 *
 * La segunda es que el fichero es puro y se puede testear en `node`. La página es
 * `"use client"` y arrastra `next/image` y el resto de `lib/shared.tsx`, así que
 * una regla de un día no debería necesitar un jsdom para comprobarse.
 */

/** Un favorito guardado, en la forma mínima que esta regla necesita. */
export type FavoritoConFecha = { date: string };

/** La clave de día local de un instante, o `null` si la fecha no se puede leer. */
function diaLocal(date: string): string | null {
  const clave = localDateKey(date);
  return clave === "sin-fecha" ? null : clave;
}

/**
 * Si un favorito corresponde a un evento que ya pasó.
 *
 * Una fecha ilegible cuenta como **futuro**, no como pasado. La razón es que
 * `readFavorites` nunca ha dejado pasar una fecha rota —las que guardó el scraper
 * sí parseaban— y ante la duda, mostrar un evento en la lista de "tus planes" es un
 * error mucho más barato que tapar un plan que quizá no ha ocurrido. Además un
 * favorito con fecha inválida tampoco acaba en 404: se queda en la web.
 */
export function yaPaso(date: string, hoy: Date = new Date()): boolean {
  const clave = diaLocal(date);
  if (clave === null) return false;
  const hoyClave = diaLocal(hoy.toISOString());
  return hoyClave !== null && clave < hoyClave;
}

/**
 * Los favoritos, ordenados y partidos en los que aun no han ocurrido y los que ya.
 *
 * El orden es por fecha, así que la lista de arriba es la que viene. Comparar por
 * cadena de día local (`YYYY-MM-DD`) ordena igual que comparar por `Date` porque el
 * formato es de ancho fijo y lexicográficamente creciente.
 */
export function partirFavoritos<T extends FavoritoConFecha>(
  favoritos: readonly T[],
  hoy: Date = new Date()
): { futuros: T[]; pasados: T[] } {
  const porFecha = [...favoritos].sort((a, b) => {
    const aClave = diaLocal(a.date);
    const bClave = diaLocal(b.date);
    if (aClave === null) return bClave === null ? 0 : 1;
    if (bClave === null) return -1;
    return aClave.localeCompare(bClave);
  });

  const futuros: T[] = [];
  const pasados: T[] = [];
  for (const favorito of porFecha) {
    (yaPaso(favorito.date, hoy) ? pasados : futuros).push(favorito);
  }
  return { futuros, pasados };
}
