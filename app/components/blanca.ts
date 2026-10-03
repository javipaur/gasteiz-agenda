import { CATEGORY_COLORS } from "@/lib/categories";
import { agendaSlug } from "@/lib/slug";
import type { FiestaBlanca } from "@/lib/sources/fiestas-blanca";

/**
 * Lo que La Blanca comparte entre la home y su página.
 *
 * Antes estaba en los dos componentes, con el mismo nombre y distinto contenido:
 * la versión de `FiestasBlancaPageClient` tenía nueve entradas y la de
 * `FiestasBlancaSection` tenía cinco. Cuatro categorías —Vaquillas, Fuegos,
 * Teatro y Humor— sólo existían en una, así que en la home caían al gris por
 * defecto y la misma fiesta se veía de un color en `/fiestas-blanca` y de otro en
 * la home según dónde se mirara. `mapFiestaToCard` estaba duplicado entero, que
 * es peor: dos funciones que deben producir la misma tarjeta divergiendo sin que
 * nada lo compruebe.
 *
 * Vive aquí y no en `lib/` porque sus dos consumidores son componentes cliente y
 * no hay un tercer uso que justificar un módulo de servidor.
 */

/**
 * Las quince de la taxonomía más las nueve propias de La Blanca.
 *
 * El spread importa: sin él, cualquier categoría que se añada a
 * `lib/categories.ts` se queda sin color y sale gris por defecto, que es
 * exactamente el fallo que traía el duplicado.
 */
export const BLANCA_COLORS: Record<string, string> = {
  ...CATEGORY_COLORS,
  "Conciertos La Blanca": "#C94A3D",
  "Niños en La Blanca": "#4A9C8C",
  "Blusas y Neskak": "#0166bf",
  "Cofradía de la Virgen Blanca": "#7a12e2",
  "Deporte en La Blanca": "#7CB342",
  Vaquillas: "#A67C52",
  Fuegos: "#FF6900",
  Teatro: "#A67C52",
  Humor: "#C97B8C",
};

/**
 * La Blanca todavía no pasa por el agregado: estas props son `FiestaBlanca` tal
 * como las devuelve el scraper, no `AgendaEvento`. Es una de las dos excepciones
 * a la regla de ESLint que prohíbe importar `eventSlug`.
 *
 * El slug sale de `agendaSlug`, que es la misma normalización que aplica
 * `normalizeRaw` en `lib/agenda.ts` —incluido el `trim` del título y el descarte
 * del `"#"`—, y también la que usa `app/fiestas-blanca/page.tsx` para su
 * JSON-LD. La tarjeta y el JSON-LD de la misma página no pueden salir con slugs
 * distintos porque ya no normalizan por su cuenta. El día que La Blanca venga del
 * agregador, esta función desaparece entera.
 */
export function mapFiestaToCard(f: FiestaBlanca) {
  return {
    id: f.id,
    slug: agendaSlug(f),
    title: f.title,
    date: f.date,
    image: f.image || undefined,
    location: f.location || undefined,
    link: f.url || undefined,
    category: f.category || "Fiestas",
    // El id del registro, no el título de la edición: `sourceLabel` solo sabe
    // traducir ids, y una etiqueta con el año dentro se queda en crudo en la pill
    // de cada tarjeta en cuanto la edición cambia.
    source: "fiestas-blanca",
    time: f.timeStart || undefined,
  };
}
