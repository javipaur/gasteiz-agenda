import { localDateStr } from "./utils";

/**
 * Datos editoriales de Moradillos 2027. No entra en el registro de fuentes:
 * es un festival de otra comunidad con una fecha concreta, no un plan de la
 * agenda de Vitoria-Gasteiz.
 *
 * La prosa, la metadata, las rutas del paquete y el fichero del cartel salen de
 * aquí. Escritos una vez en cada consumidor, el día que cambie el cartel o el
 * título habría dos sitios diciendo cosas distintas sin ningún error.
 */
export const MORADILLOS_2027 = {
  titulo: "Moradillos Fest 2027",
  fechas: "2 y 3 de julio de 2027",
  destino: "Préjano (La Rioja)",
  carteles: "Izaro y Ezezez",
  generos: "rock, psicodelia y blues",
  sede: "/moradillos-2027",
  origen: "https://moradillosfestival.es/prensa/",
  instagram: "https://www.instagram.com/moradillosfest/",
  entradas: "https://moradillosfestival.es/entradas/",
  imagenes: {
    cartel: "/moradillos-2027/cartel.jpg",
    logo: "/moradillos-2027/logo-principal.png",
    directo: "/moradillos-2027/foto-directo.jpg",
    publico: "/moradillos-2027/foto-publico.jpg",
  },
} as const;

/** La raíz de las cuatro rutas de difusión, escrita una sola vez. */
const RAIZ_API_PROMO = "/api/promo/moradillos-2027";

export const RUTAS_PROMO_MORADILLOS = {
  post: `${RAIZ_API_PROMO}/post?format=jpeg`,
  historia: `${RAIZ_API_PROMO}/historia?format=jpeg`,
  cartel: `${RAIZ_API_PROMO}/cartel`,
} as const;

/** La primera letra en mayúscula, para la frase de la metadata. */
function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function descripcionMoradillos(): string {
  const d = MORADILLOS_2027;
  return `${d.titulo}: ${d.fechas} en ${d.destino}, con ${d.carteles}. ${capitalizar(d.generos)}. Difusión editorial.`;
}

export function resumenMoradillos(): string {
  const d = MORADILLOS_2027;
  return `${d.titulo} vuelve al Valle del Cidacos con dos días de música en directo. Con ${d.carteles}, reúne ${d.generos} en un cartel que mezcla nombres nacionales e internacionales.`;
}

/**
 * Los segmentos de una URL pública, para leer el fichero desde `public/`.
 * Así `cartel.jpg` no está escrito en la ruta de imágenes ni en la de historia.
 */
export function segmentosPublicosDe(url: string): string[] {
  return url.replace(/^\/+/, "").split("/");
}

/**
 * El bloque de portada se retira el 1 de agosto de 2027. Es lo que dice la
 * decisión editorial —«hasta julio»—, y no el último día del festival: quien
 * pidió difusión pidió el mes, no los dos días del concierto.
 *
 * La fecha se compara en **Europe/Madrid** con `localDateStr`, no con UTC.
 * `getUTCMonth()` sacaba el bloque a las 22:00 del 31 de julio, cuando allí
 * todavía eran las 23:59 y seguía siendo julio.
 */
export function mostrarEnPortada(ahora: Date): boolean {
  return localDateStr(ahora) <= "2027-07-31";
}
