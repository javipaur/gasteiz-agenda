/**
 * Cómo se puede instalar esta web en el navegador que está mirando la persona.
 *
 * Módulo puro a propósito: no lee `navigator`, no importa React y no toca el DOM.
 * Lo que sí necesita del navegador se le pasa dentro de `EntradaInstalacion`, así
 * que el árbol entero se prueba en node sin jsdom. El componente lee `navigator`
 * desde un `useSyncExternalStore` con su `getServerSnapshot`.
 *
 * Existe porque **iOS no tiene `beforeinstallprompt`**. No es que a esta web le
 * falte el evento: Safari no lo dispara y no ha implementado la instalación
 * programática de una PWA. En iPhone e iPad la única forma de tener un acceso
 * directo es que la persona use "Compartir → Añadir a pantalla de inicio", y eso
 * hay que enseñárselo. Sin esta rama, todo el UI de instalación se queda en
 * `null` en el móvil que más usa el público de esta agenda.
 */

export type MetodoInstalacion =
  /** Ya está en la pantalla de inicio. No hay nada que ofrecer. */
  | "ya-instalada"
  /** iPhone, iPad e iPod: hay que describir los pasos, no hay botón que pulsing. */
  | "instrucciones-ios"
  /** El navegador ha disparado `beforeinstallprompt`: hay un botón de verdad. */
  | "navegador"
  /** Firefox y Safari de escritorio: añaden acceso a mano, pero no dan evento. */
  | "instrucciones-genericas";

export type EntradaInstalacion = {
  userAgent: string;
  maxTouchPoints: number;
  /** `display-mode: standalone`, o el `navigator.standalone` antiguo de iOS. */
  instalado: boolean;
  /** El store de `lib/useInstallPrompt.ts` tiene un evento guardado sin consumir. */
  eventoDisponible: boolean;
};

/**
 * iPhone, iPad e iPod por user agent, más el iPad.
 */
export function esIOS(userAgent: string, maxTouchPoints: number): boolean {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return true;
  // iPadOS 13+ en Modo Escritorio se anuncia como un Mac de escritorio y no hay
  // forma de separarlo del resto salvo por el táctil. El guardia de `Macintosh`
  // es lo que evita que un portátil con pantalla táctil de otro sistema caiga
  // aquí, que es el único sitio donde este heurístico puede mentir.
  return /Macintosh/i.test(userAgent) && maxTouchPoints > 1;
}

export function metodoDeInstalacion(
  entrada: EntradaInstalacion
): MetodoInstalacion {
  // Lo primero, y sin discusión: a quien ya la tiene instalada no se le ofrece.
  if (entrada.instalado) return "ya-instalada";
  // iOS antes que el evento no es una preferencia. Hoy no hay evento que
  // preferir: se comprueba en producción y en iOS no se dispara nunca, así que
  // los dos órdenes son el mismo y este dice cuál valdría si eso cambiara.
  if (esIOS(entrada.userAgent, entrada.maxTouchPoints)) return "instrucciones-ios";
  if (entrada.eventoDisponible) return "navegador";
  return "instrucciones-genericas";
}

/**
 * Si el enlace a la app nativa de Android tiene sentido en esta pantalla.
 *
 * En iOS no: Play Store es un sitio distinto y mandar allí desde un iPhone es
 * mandar a un sitio que no instala nada. En el resto, la PWA no tiene por qué
 * ser mejor que la app, y quien ya está instalado tampoco necesita el enlace.
 */
export function muestraAppNativa(entrada: EntradaInstalacion): boolean {
  return !entrada.instalado && !esIOS(entrada.userAgent, entrada.maxTouchPoints);
}