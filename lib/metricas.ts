/**
 * Los eventos que se cuentan, y por qué son estos y no otros.
 *
 * ## El problema que resuelve
 *
 * La pregunta que había sin respuesta era "cuánta gente entra y cuánta se
 * instala". Las dos se contestan desde el navegador, no desde el servidor: el
 * servidor ve peticiones, y una visita a `/` desde una PWA instalada y la misma
 * desde una pestaña de Chrome son **la misma petición**.
 *
 * Y el dato de instalación no existe en ninguna ruta: no es un campo de la
 * petición ni una cabecera. Lo que lo dice es `display-mode: standalone`, que ya
 * lee `useInstalado()` desde la fase de la instalación de la PWA. Es decir, el
 * número que faltaba ya estaba midiéndose en un hook y se descartaba.
 *
 * ## Por qué una lista cerrada y no un `string`
 *
 * Porque este endpoint es público — lo llama el navegador, que no puede traer
 * `x-api-key` — y el cuerpo lo manda cualquiera. Con un `string` libre, quien
 * descubra la ruta infla la tabla a voluntad, y un contador inflado es peor que
 * no tener contador: es un número que miente y que nadie va a mirar dos veces.
 *
 * La lista se cierra aquí y en ningún otro sitio, y `app/api/metric/route.ts` la
 * usa como filtro. Añadir un evento es escribir su nombre en este array, que es
 * lo que cuesta de verdad.
 */

/**
 * Los cinco eventos: cuatro son del embudo de instalación y uno es la visita.
 *
 * - `visita`: una carga de página, una vez por sesión y pestaña. No es "persona":
 *   es "pestaña abierta". La diferencia importa y está anotada en `Resumen`.
 * - `instalada`: la PWA se está ejecutando en modo standalone. Es el único dato
 *   que **confirma** una instalación; los otros dos son intenciones.
 * - `instalacion_aceptada` / `instalacion_descartada`: lo que respondió el
 *   diálogo del navegador. Se distinguen porque "nadie pulsó" y "pulsó y se
 *   arrepintió" son problemas distintos: el primero es que el botón no se ve, el
 *   segundo es que el diálogo asusta.
 * - `instalacion_no_disponible`: el navegador no ofreció instalar. En iOS es lo
 *   normal y no es un fallo; en Chromium es el dato que dice que el sitio no
 *   cumple los requisitos de instalación en *ese* dispositivo.
 */
export const EVENTOS = [
  "visita",
  "instalada",
  "instalacion_aceptada",
  "instalacion_descartada",
  "instalacion_no_disponible",
] as const;

export type Evento = (typeof EVENTOS)[number];

const CONOCIDOS: ReadonlySet<string> = new Set(EVENTOS);

/**
 * Si el nombre que llega por el cuerpo es uno de los cinco.
 *
 * El `Set` se deriva de `EVENTOS` en vez de escribirse al lado, para que añadir
 * un evento al array no pueda olvidarse de añadirlo también a la lista.
 */
export function esEvento(nombre: unknown): nombre is Evento {
  return typeof nombre === "string" && CONOCIDOS.has(nombre);
}

/**
 * Un resumen agregado, y lo que **no** significa.
 *
 * `visita` no es visitantes únicos: una persona que abre la PWA y la pestaña, o
 * que recarga cinco veces, cuenta cinco. Contar únicos exigiría una cookie o una
 * huella, que es justo lo que este repo no quiere: `CookieConsent.tsx` existe
 * para que el sitio no tenga tracking, y una cookie de "sólo para saber cuántos
 * sois" rompe el trato sin comprar nada que no se pueda sacar de los logs.
 *
 * La cifra que sí es de fiar es `instalada`, y no por ser un contador sino porque
 * **sólo la emite quien está en modo standalone**: es un estado del navegador, no
 * una acción que alguien pueda fingir desde la red.
 */
export type Resumen = {
  /** Filas contadas por evento. Las cinco claves están siempre. */
  porEvento: Record<Evento, number>;
  /** `SUM(porEvento.values())`, que es el total de filas contadas. */
  total: number;
  /** Instante de la primera fila que cuenta el resumen, o `null` si no hay. */
  primera: number | null;
  /** Instante de la última, o `null` si no hay. */
  ultima: number | null;
};

/** Un resumen con todas las cifras a cero, que es el estado de una tabla nueva. */
export function resumenVacio(): Resumen {
  const porEvento = {} as Record<Evento, number>;
  for (const nombre of EVENTOS) porEvento[nombre] = 0;
  return { porEvento, total: 0, primera: null, ultima: null };
}