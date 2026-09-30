import { getAgendaEventos, type AgendaEvento } from "./agenda";

export type Evento = AgendaEvento;

/**
 * Vista infantil sobre el agregado: filtra por el tag `infantil` y nada más.
 *
 * Antes este módulo scrapeaba `dest: ["infantil"]` y lo cacheaba bajo
 * `kids-eventos-mood`, mientras `app/kids/page.tsx` hacía lo mismo bajo
 * `kids-eventos`. Dos listas para los mismos eventos, cada una con su
 * `crypto.randomUUID()` de id, así que un favorito guardado desde /kids no
 * coincidía con la tarjeta de la home.
 *
 * `category` se fuerza a "Infantil" porque es la etiqueta que pintan las fichas y
 * la que leen los consumidores de esta vista; la entrada `municipal-infantil` no
 * declara categoría en el registro, porque lo que la mete aquí es el tag.
 */
export async function getKidsEventos(): Promise<Evento[]> {
  const agenda = await getAgendaEventos();

  return agenda
    .filter((ev) => ev.tags?.includes("infantil"))
    .map((ev) => ({ ...ev, category: "Infantil" }));
}
