// Importa de `source-data` y no de `source-registry` a propósito: este fichero
// lo carga `lib/shared.tsx`, que es "use client", así que llegar al registro
// compuesto arrastraría los 18 scrapers al navegador (+257 KB de chunk, medido).
// El token de la API MEC de La Genterula venía dentro. La regla la comprueba
// `__tests__/source-data.test.ts`.
//
// Y lo mismo con `lib/og-image.ts`, que se llevó el `import * as cheerio` de aquí:
// `cheerio` son 148,2 KB de chunk de cliente que el navegador no ejecutaba, porque
// su único consumidor es un scraper de servidor. `fetchOgImage` no se reexporta
// desde aquí a propósito: un reexport delataría que el fichero es cliente-safe y
// alguien volvería a colgarlo de un componente.
import { SOURCE_LABELS } from "./source-data";

export const MONTHS = [
  "ENE", "FEB", "MAR", "ABR", "MAY", "JUN",
  "JUL", "AGO", "SEP", "OCT", "NOV", "DIC",
];

export function formatDate(dateStr: string): { day: string; month: string } {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { day: "??", month: "???" };
  return {
    day: String(d.getDate()).padStart(2, "0"),
    month: MONTHS[d.getMonth()],
  };
}

export function formatSpanishDate(dateStr: string) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { day: "??", month: "???", year: "" };
  return {
    day: String(d.getDate()).padStart(2, "0"),
    month: MONTHS[d.getMonth()],
    year: String(d.getFullYear()),
  };
}

export function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Parte los eventos en **la semana que viene** y **lo que viene después**, con el
 * mismo corte que usa la rejilla de siete pestañas de la portada.
 *
 * Existe porque la portada decía lo mismo dos veces, y de la peor forma posible:
 * sin que se notara. Medido en producción el 23 de octubre de 2026, la sección
 * «Próximos eventos» pintaba doce tarjetas y **las doce** estaban ya en «Próximos
 * 7 días». No era un fallo de composición sino de aritmética: las dos secciones
 * partían de la agenda completa y cada una cortaba por su cuenta, así que la de
 * abajo cortaba justo por donde empezaba la de arriba.
 *
 * El corte tiene que ser **uno solo**, y tiene que hablar el idioma de
 * `NextDaysSection`, que agrupa por `localDateStr`. Sobre el ISO crudo,
 * `"2026-10-30T00:30:00+02:00".slice(0, 10)` da el 30 en las dos zonas, pero un
 * evento de las 00:30 en Madrid guardado en UTC da `29` y se colaría un día
 * antes en la ventana; la rejilla sí lo pondría el 30. Con `localDateStr` la
 * ventana y la rejilla cuentan días del mismo calendario.
 *
 * `dias = 7` es **hoy más los seis siguientes**, que es literalmente lo que pinta
 * la fila de pestañas, no "siete días desde ahora".
 *
 * Se devuelven las dos mitades y no solo la de después para que un test pueda
 * comprobar que no se solapan y que no se pierde nada por el medio. Un evento con
 * fecha ilegible no entra en ninguna: pintarlo sería inventar un día.
 */
export function partirEnSemana<T extends { date: string }>(
  eventos: T[],
  ahora: number,
  dias = 7
): { semana: T[]; despues: T[] } {
  const hoy = new Date(ahora);
  hoy.setHours(0, 0, 0, 0);
  const desdeHoy = localDateStr(hoy);

  const corte = new Date(hoy);
  corte.setDate(corte.getDate() + dias);
  const desdeDespues = localDateStr(corte);

  const semana: T[] = [];
  const despues: T[] = [];

  for (const ev of eventos) {
    const d = new Date(ev.date);
    if (isNaN(d.getTime())) continue;
    const dia = localDateStr(d);
    if (dia < desdeHoy) continue;
    if (dia < desdeDespues) semana.push(ev);
    else despues.push(ev);
  }

  return { semana, despues };
}

export function sourceLabel(source?: string): string {
  if (!source) return "";
  // El mapa se resuelve en la llamada y no al cargar el módulo. Este fichero lo
  // carga `lib/shared.tsx`, que es un componente cliente, así que la frontera que
  // de verdad importa es la del import de arriba: solo la hoja de datos, nunca el
  // registro compuesto, o los 18 scrapers acabarían en el navegador. Resolverlo
  // aquí dentro deja además esta función sin nada construido en el ámbito del
  // módulo.
  return SOURCE_LABELS[source] ?? source;
}

export function dayBadgeLabel(dateStr: string): string | null {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const target = localDateStr(d);
  if (target === localDateStr(today)) return "HOY";
  if (target === localDateStr(tomorrow)) return "MAÑ";
  return null;
}

export function shortTime(time?: string): string | null {
  if (!time) return null;
  const t = time.trim();
  const m = t.match(/^(\d{1,2})[:.h](\d{2})/i);
  if (m) return `${m[1]}:${m[2]}`;
  if (/^\d{1,2}$/.test(t)) return `${t}:00`;
  return null;
}
