export type SectionTintKey =
  | "conciertos"
  | "cine"
  | "cultura"
  | "kids"
  | "deporte"
  | "turismo"
  | "gastronomia"
  | "fiestas";

export type SectionTint = {
  bar: string;
  text: string;
  active: string;
};

export const SECTION_TINT: Record<SectionTintKey, SectionTint> = {
  conciertos: {
    bar: "bg-sec-teal",
    text: "text-sec-teal",
    active: "bg-sec-teal-fill text-white",
  },
  cine: {
    bar: "bg-sec-blue",
    text: "text-sec-blue",
    active: "bg-sec-blue-fill text-white",
  },
  cultura: {
    bar: "bg-sec-accent",
    text: "text-sec-accent",
    active: "bg-accent text-white",
  },
  kids: {
    bar: "bg-sec-amber",
    text: "text-sec-amber",
    active: "bg-sec-amber-fill text-white",
  },
  deporte: {
    bar: "bg-sec-green",
    text: "text-sec-green",
    active: "bg-sec-green-fill text-white",
  },
  turismo: {
    bar: "bg-sec-teal",
    text: "text-sec-teal",
    active: "bg-sec-teal-fill text-white",
  },
  gastronomia: {
    bar: "bg-sec-amber",
    text: "text-sec-amber",
    active: "bg-sec-amber-fill text-white",
  },
  fiestas: {
    bar: "bg-sec-accent",
    text: "text-sec-accent",
    active: "bg-accent text-white",
  },
};