/**
 * `prefers-reduced-motion` para el movimiento que manda JavaScript.
 *
 * Por qué un módulo y no repetir el `matchMedia` en cada componente.
 * `app/globals.css` ya neutraliza transiciones y animaciones CSS con un bloque
 * `@media (prefers-reduced-motion: reduce)` global, así que parece que la
 * preferencia está respetada. No lo está para el movimiento por script: ese CSS
 * no toca `scrollBy`, ni `window.scrollTo`, ni el `flyTo` de Leaflet, porque
 * ninguno de los tres es una transición CSS — son desplazamiento animado pedido
 * a la API. El síntoma es un usuario con `reduce` viendo moverse un riel de
 * tarjetas y un mapa volando 0,8 s, que es justo lo que esa preferencia existe
 * para evitar.
 *
 * Vive en `app/components/` y no en `lib/` porque sus tres consumidores son
 * componentes cliente y no tiene ningún uso del lado del servidor: así el grafo
 * de imports que vigila `__tests__/source-data.test.ts` no tiene que comprobar
 * nada aquí, y un módulo de `lib/` que sólo usa el cliente acaba siendo código
 * muerto en el servidor.
 *
 * Se lee la preferencia **en el momento del gesto**, no al montar. Una consulta
 * cacheada en un `useState` se queda congelada con el valor que tenía al
 * cargarse la página, y quien cambia la preferencia en mitad de la sesión
 * seguiría viendo el desplazamiento animado.
 */

/**
 * `true` si el sistema pide reducir el movimiento.
 *
 * Se devuelve `false` en servidor y si `matchMedia` no existe (o lanza), porque
 * "no lo sé" y "no lo han pedido" tienen que llevar al mismo camino: un
 * componente de servidor que se renderiza dos veces, una con reduce y otra sin,
 * produciría un desajuste de hidratación.
 */
export function prefiereMenosMovimiento(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * `behavior` para `scrollBy` y `scrollTo`.
 *
 * `"auto"` no es "sin animación siempre": es "el que toque". Con la preferencia
 * puesta el navegador salta al destino; sin ella, aquí se le pide `"smooth"` y
 * se comporta como hasta ahora.
 */
export function comportamientoDeDesplazamiento(): ScrollBehavior {
  return prefiereMenosMovimiento() ? "auto" : "smooth";
}

/**
 * Duración para una animación de mapa.
 *
 * `0` en Leaflet significa salto instantáneo al centro y al zoom pedidos, que es
 * el equivalente del `behavior: "auto"` de arriba. No se devuelve `undefined`
 * porque entonces Leaflet usaría su curva por defecto.
 */
export function duracionDeVuelo(segundos: number): number {
  return prefiereMenosMovimiento() ? 0 : segundos;
}
