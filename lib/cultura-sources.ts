export const CULTURE_SOURCES = [
  "municipal",
  "jimmyjazz",
  "vam",
  "fever",
  "rula",
  "gasteizhoy",
] as const;

export const CULTURE_SOURCE_PILLS: Record<string, { key: string; label: string }[]> = {
  conciertos: [
    { key: "all", label: "Todos" },
    { key: "jimmyjazz", label: "Jimmy Jazz" },
    { key: "vam", label: "VAM Cultura" },
    { key: "municipal", label: "Agenda" },
    { key: "fever", label: "Fever" },
    { key: "rula", label: "Rula" },
    { key: "gasteizhoy", label: "Gasteiz Hoy" },
  ],
};

export const CULTURE_SOURCE_LABELS: Record<string, string> = {
  jimmyjazz: "Jimmy Jazz",
  vam: "VAM Cultura",
  municipal: "Agenda Municipal",
  fever: "Fever",
  rula: "Rula",
  gasteizhoy: "Gasteiz Hoy",
};