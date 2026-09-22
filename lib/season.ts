export type AccentSeason =
  | "otono"
  | "invierno"
  | "primavera"
  | "verano"
  | "navidad"
  | "san-prudencio"
  | "blusas";

export function getAccentSeason(now: Date = new Date()): AccentSeason {
  const md = (now.getMonth() + 1) * 100 + now.getDate();

  if (md >= 1220 || md <= 106) return "navidad";
  if (md >= 426 && md <= 429) return "san-prudencio";
  if (md >= 804 && md <= 809) return "blusas";

  if (md >= 320 && md < 621) return "primavera";
  if (md >= 621 && md < 923) return "verano";
  if (md >= 923 && md < 1222) return "otono";
  return "invierno";
}