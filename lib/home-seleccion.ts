import { recomendados } from "./recomendados";
import { localDateStr } from "./utils";
import type { Evento } from "./eventos";

export const LIMITE_PLANES_HOY = 6;
export const LIMITE_RECOMENDADOS_HOME = 10;

export type SeleccionHome = {
  /** Los seis que pinta «Hoy en Vitoria», con hora primero. */
  planesDeHoy: Evento[];
  /** El total del día, que es lo que dice la cabecera y el enlace a `/hoy`. */
  totalDeHoy: number;
  /** Los recomendados de hoy **sin** ninguno de los seis de arriba. */
  recomendadosDeHoy: (Evento & { ranking: number })[];
};

/**
 * Una sola decisión para los dos bloques que responden a la misma pregunta.
 *
 * «Hoy en Vitoria» y «Qué recomendamos» se calculaban en dos loaders distintos,
 * con dos `Date.now()` y dos listas de hoy. Eso no daba un error: daba el mismo
 * evento dos veces en dos secciones consecutivas, una con el orden del día y
 * otra con el de la puntuación. La persona lo ve, y ningún test lo veía.
 *
 * Aquí el día se lee una vez con `localDateStr` —la fecha civil de Vitoria, no
 * la del proceso— y los seis de hoy se eligen antes de pedir los recomendados.
 * El excluido es el `id`, que es el `slug` que luego aparece en el enlace: si
 * algo cambiara ahí, el test de las dos secciones lo encontraría en el href.
 *
 * No lee el reloj: el instante entra como argumento y lo decide el servidor una
 * sola vez por petición. Un selector que leyera `Date.now()` por su cuenta
 * podría devolver dos respuestas distintas dentro del mismo render.
 */
export function seleccionHome(eventos: Evento[], ahora: number): SeleccionHome {
  const hoy = localDateStr(new Date(ahora));
  const deHoy = eventos.filter((e) => localDateStr(new Date(e.date)) === hoy);

  // `sort` es estable en ES2019, así que los que no traen hora conservan el
  // orden del agregado, que ya viene por relevancia. Es el mismo criterio que
  // tenía `TodayDecision` cuando la lista se calculaba dentro del componente.
  const planesDeHoy = [...deHoy]
    .sort((a, b) => Number(Boolean(b.time)) - Number(Boolean(a.time)))
    .slice(0, LIMITE_PLANES_HOY);

  const yaEnHoy = new Set(planesDeHoy.map((e) => e.id));
  const candidatos = eventos.filter((e) => !yaEnHoy.has(e.id));

  // `recomendados` vuelve a filtrar por fecha, y eso no es trabajo repetido:
  // es la puerta que comparten `/hoy` y el paquete de redes. Lo que aquí se
  // añade es solo la exclusión de lo que ya se ha enseñado arriba.
  const recomendadosDeHoy = recomendados(candidatos, {
    desde: hoy,
    hasta: hoy,
    limite: LIMITE_RECOMENDADOS_HOME,
    hoy: new Date(ahora),
  }).map((e, i) => ({ ...e, ranking: i + 1 }));

  return {
    planesDeHoy,
    totalDeHoy: deHoy.length,
    recomendadosDeHoy,
  };
}
