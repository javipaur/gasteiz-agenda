const BLANCA_WINDOW_START_MONTH = 7;
const BLANCA_WINDOW_START_DAY = 15;
const BLANCA_WINDOW_END_MONTH = 8;
const BLANCA_WINDOW_END_DAY = 12;

export function isBlancaSeason(date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  const month = get("month");
  const day = get("day");

  if (month === BLANCA_WINDOW_START_MONTH && day >= BLANCA_WINDOW_START_DAY) return true;
  if (month === BLANCA_WINDOW_END_MONTH && day <= BLANCA_WINDOW_END_DAY) return true;
  return false;
}

export function blancaNextEditionYear(date = new Date()): number {
  return isBlancaSeason(date) ? date.getFullYear() : date.getFullYear() + (date.getMonth() >= 7 ? 1 : 0);
}

/**
 * El año de la edición de la que salen estas fechas, o `null` si no hay ninguna
 * fecha utilizable.
 *
 * Es lo que permite que el scraper de La Blanca no lleve el año cableado. El
 * calendario municipal (`calendariosID=513`) devuelve `fechaInicio` con su año, así
 * que el año se lee de los datos en lugar de escribirlo: con el año en el código,
 * el día que termina la edición el scraper sigue pidiendo el rango del año
 * anterior, que ya no devuelve nada, y la sección se vacía sola.
 *
 * Se queda con el año de la fecha más temprana y no con el último que aparece: la
 * identidad de una edición es cuándo empieza.
 */
export function blancaEditionYear(dates: readonly string[]): number | null {
  const anios = dates
    .map((fecha) => /^(\d{4})-\d{2}-\d{2}/.exec(fecha)?.[1])
    .filter((anio): anio is string => Boolean(anio))
    .map(Number);
  if (anios.length === 0) return null;
  return Math.min(...anios);
}
