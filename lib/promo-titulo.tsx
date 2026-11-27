import type { ReactElement } from "react";
import { normalizarTituloPromo } from "./promo";

/**
 * El título de una diapositiva del carrusel, sin recortes.
 *
 * **Antes se cortaba a 96 caracteres** y el 27 de noviembre de 2026 eso partió por la
 * mitad una exposición municipal: la imagen decía «…las personas que habitamos el
 * barrio,…» y callaba «los hilos que conforman nuestro paño». No hubo ningún error:
 * un título incompleto sigue siendo un título, y nadie mira el código de una imagen.
 *
 * Recortar no es una solución: basta con que un día llegue uno más largo. Satori no
 * ajusta la letra solo, así que la que baja es esta función. Los escalones se eligen
 * para que el texto quepa en los 952 px del marco sin llegar a ser pequeño: un título
 * de 133 caracteres a 32 px ocupa tres líneas, y el de «Cobardes» se queda en 52.
 */
/**
 * El título que se pinta en la diapositiva y el que anuncia el paquete tienen que
 * salir de la misma normalización. El 27 de noviembre de 2026 el paquete decía
 * «Cobardes» y la imagen, leyendo el título crudo del agregado, decía «Cobardes (27
 * de noviembre, Vitoria-Gasteiz)». La fecha no es parte del nombre del plan.
 */
export function tituloDeDiapositiva(titulo: string): string {
  return normalizarTituloPromo(titulo).replace(/\s+/g, " ").trim();
}

export function tamanoTituloPromo(titulo: string): number {
  const longitud = titulo.trim().length;
  if (longitud <= 60) return 52;
  if (longitud <= 90) return 44;
  if (longitud <= 120) return 38;
  return 32;
}

/** Un `<div>` con un solo hijo: Satori no necesita `display`, pero lo declara igual. */
export function TituloPromo({ titulo }: { titulo: string }): ReactElement<{
  children: string;
  style: Record<string, unknown>;
}> {
  return (
    <div
      style={{
        display: "flex",
        fontSize: tamanoTituloPromo(titulo),
        fontWeight: 800,
        lineHeight: 1.1,
        letterSpacing: "-0.02em",
        marginTop: 14,
      }}
    >
      {titulo}
    </div>
  );
}
