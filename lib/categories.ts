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
  "ninos": "Infantil",
  "ninos/as": "Infantil",
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
  Música: "#FF4D7D",
  Teatro: "#7B4DFF",
  Cine: "#FFB300",
  Exposiciones: "#FF8A3D",
  Infantil: "#00D2C8",
  Deporte: "#9BFF57",
  Danza: "#FF6FD8",
  Festival: "#FF4D7D",
  Conferencias: "#7B4DFF",
  Fiestas: "#FF4D7D",
  Visitas: "#00D2C8",
  Talleres: "#FF8A3D",
  Gastronomía: "#FFB300",
  Senderismo: "#9BFF57",
  Otros: "#7C8794",
};

export const CATEGORY_FILLS: Record<string, string> = {
  Música: "#FF4D7D",
  Teatro: "#6B32DA",
  Cine: "#E8A32E",
  Exposiciones: "#E8742A",
  Infantil: "#00B8AE",
  Deporte: "#7ADB39",
  Danza: "#EB53C4",
  Festival: "#FF4D7D",
  Conferencias: "#6B32DA",
  Fiestas: "#FF4D7D",
  Visitas: "#00B8AE",
  Talleres: "#E8742A",
  Gastronomía: "#E8A32E",
  Senderismo: "#7ADB39",
  Otros: "#565E68",
};
