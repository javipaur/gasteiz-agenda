/**
 * Datos que `/culture` necesita en el cliente, deducidos del registro de fuentes.
 *
 * Este fichero lo importa `CulturePageClient.tsx`, que es `"use client"`, así que
 * importa de `lib/source-data.ts` y nunca de `lib/source-registry.ts`: el
 * registro compuesto lleva la función de scraping de las 27 fuentes y con él los
 * scrapers al bundle del navegador. La regla la comprueba
 * `__tests__/source-data.test.ts`.
 *
 * Antes estas tres listas estaban escritas a mano, y por eso se quedaron viejas:
 * las claves eran `"municipal"` y `"vam"`, ids que el agregador ya no emite, así
 * que el filtro por fuente de `/culture` devolvía cero resultados sin dar ningún
 * error. Ahora salen del registro y no pueden volver a desincronizarse.
 */

import { CULTURE_SOURCE_IDS, SOURCE_LABELS } from "./source-data";

/** Fuentes que la vista `/culture` puede filtrar, deducidas del registro. */
export const CULTURE_SOURCES = CULTURE_SOURCE_IDS;

/**
 * El `?? id` no es una posibilidad real: `CULTURE_SOURCE_IDS` sale de `SOURCE_DATA`
 * y toda entrada tiene `label`. Está porque `SOURCE_LABELS` es `Partial` a
 * propósito, para que quien busque una clave que no exista tenga que poner el
 * fallback. Aquí el id sí es una etiqueta aceptable: es mejor que `undefined`.
 */
export const CULTURE_SOURCE_LABELS: Record<string, string> = Object.fromEntries(
  CULTURE_SOURCE_IDS.map((id) => [id, SOURCE_LABELS[id] ?? id])
);

/**
 * Misma forma que usa `CulturePageClient`: `Record<bucket, { key, label }[]>`.
 * Solo `conciertos` tiene pills porque es el único bucket que las pinta.
 *
 * Se ofrecen todas las fuentes de cultura, no solo las musicales: el bucket ya
 * está filtrando por categoría, así que el filtro por fuente tiene que poder
 * combinarse con cualquiera de ellas. Con una lista de las musicales, la
 * combinación "conciertos + Ayuntamiento" sería inalcanzable.
 */
export const CULTURE_SOURCE_PILLS: Record<string, { key: string; label: string }[]> = {
  conciertos: [
    { key: "all", label: "Todos" },
    ...CULTURE_SOURCE_IDS.map((id) => ({ key: id, label: SOURCE_LABELS[id] ?? id })),
  ],
};
