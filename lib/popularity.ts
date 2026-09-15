import type { Evento } from "./eventos";

const SOURCE_WEIGHT: Record<string, number> = {
  fever: 40,
  "vitoria-gasteiz": 25,
  euskadi: 20,
  gasteizhoy: 20,
  vam: 18,
  rula: 15,
  desconocido: 5,
};

const CATEGORY_WEIGHT: Record<string, number> = {
  Conciertos: 30,
  Música: 30,
  Teatro: 22,
  "La Blanca": 25,
  Exposiciones: 18,
  Infantil: 18,
  Deporte: 14,
  Senderismo: 12,
  Gastronomía: 16,
  Cine: 12,
};

export function scoreEvento(e: Evento, today = new Date()): number {
  let score = 0;

  score += SOURCE_WEIGHT[e.source || "desconocido"] ?? 5;

  if (e.category) {
    score += CATEGORY_WEIGHT[e.category] ?? 10;
  }

  if (e.image) score += 15;
  if (e.price) score += 8;
  if (e.rating && e.rating >= 4) score += Math.round(e.rating * 4);
  if (e.description && e.description.length > 80) score += 5;

  const date = new Date(e.date);
  if (!isNaN(date.getTime())) {
    const diffDays = (date.getTime() - today.getTime()) / 86400000;
    if (diffDays >= 0 && diffDays <= 14) {
      score += Math.round((1 - diffDays / 14) * 20);
    }
  }

  return score;
}

export function getPopularEvents(
  eventos: Evento[],
  limit = 10,
  today = new Date()
): Evento[] {
  return [...eventos]
    .filter((e) => e.image)
    .map((e) => ({ ...e, popularity: scoreEvento(e, today) }))
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    .slice(0, limit);
}