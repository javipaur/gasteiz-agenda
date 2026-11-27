import {
  NAVIDAD_2026,
  POR_CONFIRMAR,
  diaCortoNavidad,
} from "./navidad-vitoria";

/**
 * Los planos del reel no son los del carrusel. El carrusel elige ocho para
 * Instagram; el reel tiene que poder decir qué hay en la agenda entera, con la
 * fecha y la hora de inicio de cada plan. Si el generador leyera `diapositivas`,
 * los cinco planes que no están en el carrusel desaparecerían sin ningún error.
 */
export type PlanoReelNavidad = {
  numero: number;
  id: string;
  titulo: string;
  fechaInicio: string;
  fechaFin?: string;
  horaInicio: string;
  horaFin?: string;
  lugar: string;
  precio: string;
  fuente: string;
  pendiente: boolean;
};

function dia(valor: string): string {
  return valor === POR_CONFIRMAR ? POR_CONFIRMAR : diaCortoNavidad(valor);
}

export const PLANOS_REEL_NAVIDAD: PlanoReelNavidad[] = NAVIDAD_2026.eventos.map(
  (evento, indice) => ({
    numero: indice + 1,
    id: evento.id,
    titulo: evento.titulo,
    fechaInicio: dia(evento.fecha),
    fechaFin: evento.fechaFin ? dia(evento.fechaFin) : undefined,
    horaInicio: evento.hora,
    horaFin: evento.horaFin,
    lugar: evento.lugar,
    precio: evento.precio,
    fuente: evento.fuentes[0]!.titulo,
    pendiente: [evento.fecha, evento.hora, evento.precio].some(
      (dato) => dato === POR_CONFIRMAR,
    ),
  }),
);
