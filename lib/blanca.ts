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
