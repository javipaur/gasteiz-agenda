import type { Evento } from "./eventos";

export type AtAGlance = {
  hoy: number;
  finde: number;
  semana: number;
  fechaLabel: string;
};

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseDate(dateStr: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (m) {
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

export function esHoy(dateStr: string, now: Date): boolean {
  const d = parseDate(dateStr);
  return !!d && toLocalDateStr(d) === toLocalDateStr(now);
}

export function esEstaSemana(dateStr: string, now: Date): boolean {
  const d = parseDate(dateStr);
  if (!d) return false;
  const hoy = startOfDay(now);
  const limite = new Date(hoy);
  limite.setDate(limite.getDate() + 7);
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return t >= hoy.getTime() && t < limite.getTime();
}

export function esEsteFinde(dateStr: string, now: Date): boolean {
  if (!esEstaSemana(dateStr, now)) return false;
  const d = parseDate(dateStr)!;
  const wd = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getDay();
  return wd === 0 || wd === 6;
}

export function formatFechaViva(date: Date): string {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(date);
}

export function getAtAGlance(eventos: Evento[], now = new Date()): AtAGlance {
  return {
    hoy: eventos.filter((e) => esHoy(e.date, now)).length,
    finde: eventos.filter((e) => esEsteFinde(e.date, now)).length,
    semana: eventos.filter((e) => esEstaSemana(e.date, now)).length,
    fechaLabel: formatFechaViva(now),
  };
}
