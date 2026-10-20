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
  // Euskadi no manda tipo cuando no lo reconoce, y lo manda como "evento".
  // Sin este alias sale una categoria sin color: gris en la tarjeta y el
  // identificador en crudo en /agenda/[mes].
  "evento": "Otros",

  // Los seis de abajo no salen de leer el código: salen de contar la agenda en
  // vivo el 5 de octubre de 2026. `normalizeCategory` se terminaba en
  // `CATEGORY_ALIASES[key] || cat`, así que una clave que no estuviera aquí
  // pasaba sin tocar y **sin color, sin peso de popularidad y fuera de toda página
  // de sección**. Medido: 90 eventos de 1457, el 6,2%.
  //
  //   "Teatro y danza"  35  rula
  //   "otro"            20  euskadi
  //   "formación"       20  euskadi
  //   "deportiva"       12  municipal-rss
  //   "Literatura"       2  rula
  //   "feria"            1  euskadi
  //
  // Se traducen al vocabulario de aquí y no al revés: la taxonomía son las quince
  // de `CATEGORY_COLORS`, que es lo que tiene color, peso y página. Añadir
  // "Literatura" por dos poetry jams obligaría a darle las tres cosas para que
  // `/culture/[categoria]` no se quedara con un cubo de dos eventos.
  "teatro y danza": "Teatro",
  "otro": "Otros",
  "formacion": "Talleres",
  "deportiva": "Deporte",
  "literatura": "Otros",
  "feria": "Otros",
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

/**
 * El color de la categoría, en **relleno profundo**.
 *
 * ## De dónde sale
 *
 * De una referencia concreta —`cazaplan.app`— y de su regla: **texto claro sobre
 * relleno saturado**. Ni píldora clara con tinta oscura, ni degradado con foto
 * debajo: un color hondo y la letra en blanco encima. Es lo que hace que el
 * titular se lea sin tener que pelearse con la imagen.
 *
 * ## Por qué son dos mapas con los mismos valores
 *
 * Antes eran distintos: `CATEGORY_COLORS` era el color **claro** de la píldora
 * pequeña —con tinta oscura encima— y `CATEGORY_FILLS` el **hondo** de los chips
 * grandes, con texto blanco. Con la regla nueva, la píldora también lleva texto
 * blanco, así que los dos mapas llevan lo mismo.
 *
 * Y se quedan los dos, porque cada uno dice una cosa distinta aunque ahora
 * coincidan: uno es "el color de esta categoría" y el otro es "el relleno que
 * lleva texto blanco". Un test los compara (`__tests__/categories.test.ts`) para
 * que no se separen otra vez por costumbre.
 *
 * ## Los 16 valores, medidos
 *
 * Todos pasan AA (4,5:1) con blanco encima, que es el texto que va. La cifra no
 * se estima: la calcula el test de contraste contra el propio fichero, y ese
 * test falla si alguien cambia un color por uno que no pasa.
 */
export const CATEGORY_COLORS: Record<string, string> = {
  Música: "#B3203F",
  Teatro: "#1E4A8A",
  Cine: "#4A3B6E",
  Exposiciones: "#B0562E",
  Infantil: "#2E7D4F",
  Deporte: "#1F6E6A",
  Danza: "#A03A6B",
  Festival: "#B3203F",
  Conferencias: "#1E4A8A",
  Fiestas: "#B0562E",
  Visitas: "#6B3A6E",
  Talleres: "#9A6B1E",
  Gastronomía: "#8A5A24",
  Senderismo: "#2E7D4F",
  Mercados: "#9A6B1E",
  Otros: "#6B675C",
};

/**
 * El relleno de la categoría, para los sitios donde va **texto blanco**.
 *
 * Los mismos valores que `CATEGORY_COLORS` y por el mismo motivo: la regla es
 * texto claro sobre relleno saturado. Se mantiene el mapa aparte porque quien lo
 * usa —los filtros de la agenda— está eligiendo un relleno, no una etiqueta.
 */
export const CATEGORY_FILLS: Record<string, string> = {
  Música: "#B3203F",
  Teatro: "#1E4A8A",
  Cine: "#4A3B6E",
  Exposiciones: "#B0562E",
  Infantil: "#2E7D4F",
  Deporte: "#1F6E6A",
  Danza: "#A03A6B",
  Festival: "#B3203F",
  Conferencias: "#1E4A8A",
  Fiestas: "#B0562E",
  Visitas: "#6B3A6E",
  Talleres: "#9A6B1E",
  Gastronomía: "#8A5A24",
  Senderismo: "#2E7D4F",
  Mercados: "#9A6B1E",
  Otros: "#6B675C",
};
