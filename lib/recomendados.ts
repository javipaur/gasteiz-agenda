import { scoreEvento } from "./popularity";
// `import type` y no `import`: TypeScript lo borra al compilar, y este módulo lo
// carga un componente cliente. Un import de valor de `./eventos` arrastraría
// `lib/agenda` → el registro compuesto → los 28 scrapers al bundle del navegador. La
// regla la comprueba `__tests__/source-data.test.ts`, y por eso el `import` de valor
// de arriba sí es de valor: `scoreEvento` es aritmética pura.
import type { Evento } from "./eventos";

/**
 * Cuánto pesa que un evento lo cuente más de una fuente.
 *
 * **5, y no 10, y el motivo es aritmética y está medido en
 * `__tests__/recomendados.test.ts`.** Los pesos de `lib/popularity.ts` dan 25 al
 * grupo `municipal` y 5 al mínimo, y las categorías van de 10 a 30. Un bono de 10
 * por fuente extra, con el tope de tres, son 30 puntos: suficientes para que un
 * evento de peso mínimo confirmado por tres páginas ganara a un concierto del
 * Ayuntamiento, 77 contra 67. Con cinco son 15, que giran empates cercanos y no
 * más.
 */
const BONO_POR_FUENTE_EXTRA = 5;

/**
 * Cuántas fuentes extra cuentan, y nada más.
 *
 * Sin tope, un evento con seis fuentes de peso mínimo sumaría 30 y aplastaría a un
 * concierto del Ayuntamiento, que es de lo más real que publica la agenda. Con tope
 * en tres, tres fuentes coinciden y la cuarta ya no acumula: la señal dice "esto está
 * confirmado por varios sitios", no "esto tiene muchas fuentes".
 */
const EXTRAS_QUE_CUENTAN = 3;

export const LIMITE_POR_DEFECTO = 8;

export type VentanaRecomendados = {
  /** `YYYY-MM-DD`, inclusive. */
  desde: string;
  /** `YYYY-MM-DD`, inclusive y con el día entero. */
  hasta: string;
  /** Para la cercanía de `scoreEvento`. Por defecto, ahora. */
  hoy?: Date;
  /** Por defecto, `LIMITE_POR_DEFECTO`. */
  limite?: number;
};

/** El último instante del día, en hora local. Es la misma magnitud que usa `agenda.ts`. */
function finDeDia(ymd: string): Date {
  const d = new Date(`${ymd}T00:00:00`);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Qué va en una lista de recomendados, y es el único sitio que lo decide.
 *
 * El mismo criterio lo usan la home y `/hoy`, y soon el mismo módulo lo usará el
 * paquete de redes. Dos copias divergen sin avisar.
 *
 * **Sin tope por categoría.** Es la decisión tomada y la consecuencia se acepta: un
 * día con cinco conciertos da cinco conciertos, y la lista lo dirá con sus
 * repeticiones. Si molesta, el tope son tres líneas más aquí y en el test.
 */
export function recomendados(
  eventos: Evento[],
  { desde, hasta, hoy = new Date(), limite = LIMITE_POR_DEFECTO }: VentanaRecomendados
): Evento[] {
  const desdeDate = new Date(`${desde}T00:00:00`);
  const hastaDate = finDeDia(hasta);
  // Una fecha que no parsea es `Invalid Date`, y comparar contra ella con `<=` deja
  // pasar todo: `NaN` es false en ambos sentidos, así que una `hasta` rota
  // devolvería la agenda entera en vez de una lista vacía. La comprobación va antes
  // del filtro y no dentro.
  if (isNaN(desdeDate.getTime()) || isNaN(hastaDate.getTime())) return [];

  const enVentana = eventos.filter((e) => {
    const d = new Date(e.date);
    return d >= desdeDate && d <= hastaDate;
  });

  return enVentana
    // Sin imagen no hay tarjeta que mirar. Es el mismo filtro que ya aplica
    // `getPopularEvents`, y por el mismo motivo.
    .filter((e) => e.image)
    .map((evento, i) => {
      const extras = Math.min(Math.max((evento.corrobora ?? 1) - 1, 0), EXTRAS_QUE_CUENTAN);
      return { evento, score: scoreEvento(evento, hoy) + extras * BONO_POR_FUENTE_EXTRA, i };
    })
    // El desempate es la posición de entrada, igual que en `getPopularEvents`: es lo
    // que garantiza el sort estable sin depender de esa garantía en ninguna parte.
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, limite)
    .map((x) => x.evento);
}