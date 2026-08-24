const CATEGORY_ALIASES: Record<string, string> = {
  "musica": "Música",
  "música": "Música",
  "conciertos": "Música",
  "concierto": "Música",
  "cine": "Cine",
  "cine y audiovisuales": "Cine",
  "película": "Cine",
  "pelicula": "Cine",
  "teatro": "Teatro",
  "exposiciones": "Exposiciones",
  "exposición": "Exposiciones",
  "exposicion": "Exposiciones",
  "expo": "Exposiciones",
  "infantil": "Infantil",
  "niños": "Infantil",
  "niños/as": "Infantil",
  "familia": "Infantil",
  "deporte": "Deporte",
  "danza": "Danza",
  "festival": "Festival",
  "conferencias": "Conferencias",
  "conferencia": "Conferencias",
  "charla": "Conferencias",
  "charlas": "Conferencias",
  "fiestas": "Fiestas",
  "visitas": "Visitas",
  "visita guiada": "Visitas",
  "visitas guiadas": "Visitas",
  "talleres": "Talleres",
  "taller": "Talleres",
  "workshop": "Talleres",
  "gastronomía": "Gastronomía",
  "gastronomia": "Gastronomía",
  "senderismo": "Senderismo",
  "excursiones": "Senderismo",
  "cultura": "Otros",
  "agenda": "Otros",
  "otros": "Otros",
};

export function normalizeCategory(cat?: string): string {
  if (!cat) return "Otros";
  const key = cat.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  return CATEGORY_ALIASES[key] || cat;
}

export const CULTURA_CATEGORIAS = [
  { slug: "teatro", label: "Teatro" },
  { slug: "conciertos", label: "Conciertos" },
  { slug: "exposiciones", label: "Exposiciones" },
  { slug: "agenda", label: "Agenda cultural" },
] as const;

export type CulturaCategoriaSlug = (typeof CULTURA_CATEGORIAS)[number]["slug"];

export function mapToCultureCategory(category: string): string {
  const cat = category.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (cat === "teatro") return "teatro";
  if (["musica", "conciertos", "concierto"].includes(cat)) return "conciertos";
  if (["exposiciones", "exposicion"].includes(cat)) return "exposiciones";
  return "agenda";
}

export const CATEGORY_COLORS: Record<string, string> = {
  Música: "#C94A3D",
  Teatro: "#A67C52",
  Cine: "#4A7C9C",
  Exposiciones: "#2B6B4A",
  Infantil: "#4A9C8C",
  Deporte: "#7CB342",
  Danza: "#C97B8C",
  Festival: "#A67C52",
  Conferencias: "#8C6B9C",
  Fiestas: "#C94A3D",
  Visitas: "#2B6B4A",
  Talleres: "#8C6B9C",
  Gastronomía: "#A67C52",
  Senderismo: "#7CB342",
  Otros: "#9C9996",
};
