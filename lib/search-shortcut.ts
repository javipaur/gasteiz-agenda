"use client";

import { useEffect, useRef } from "react";

/**
 * Un solo atajo de búsqueda en toda la página, y **un solo dueño**.
 *
 * ## El problema
 *
 * El `Header` y el `HeroSearch` **los dos** escuchaban `Ctrl+K` / `⌘K` en
 * `window`, y los dos anuncian el atajo con el cartelito `⌘K` al lado. Con los
 * dos escuchando, una sola tecla hacía dos cosas: el `Header` abría su panel
 * **y** el `HeroSearch` enfocaba su input **y** abría el suyo. Dos paneles
 * abiertos, una tecla y un foco que caía en el input que no era el que se había
 * abierto.
 *
 * ## La regla
 *
 * **Manda el último registrado**, y el orden de registro es el de montaje, que
 * es el de la jerarquía: el `Header` está en el layout y se registra antes que
 * el `HeroSearch` de la portada, que es más profundo.
 *
 * Así el atajo responde a la búsqueda que la persona tiene delante —la grande de
 * la portada, con su cartel al lado— y en el resto de páginas, que no tienen
 * hero, a la del `Header`. Y en los dos casos se abre **un** panel y el foco
 * cae en el input de ese panel.
 *
 * ## Por qué un registro y no un evento
 *
 * Un `CustomEvent` dejaría que los dos oyeran el atajo y cada uno decidiera si
 * le tocaba, y eso es un sitio más donde decidir. Aquí decide una sola regla,
 * que es la misma para todos.
 */
type Manejador = () => void;

const manejadores: Manejador[] = [];

/**
 * Registra un manejador del atajo y devuelve la función para quitarlo.
 *
 * El manejador se guarda **una vez**, al montar, y lo que se guarda es una
 * indirección: si se guardara la función directamente, un `useEffect` que se
 * volviera a ejecutar la quitaría y la volvería a añadir al final de la lista,
 * y el orden —que es la regla— cambiaría sin que nadie lo pidiera.
 */
export function useAtajoBusqueda(manejador: Manejador): void {
  const ref = useRef(manejador);

  // El manejador se guarda en un ref para que el registro **no** dependa de su
  // identidad: si dependiera, un re-render lo quitaría y lo volvería a añadir al
  // final de la lista, y el orden —que es la regla— cambiaría sin que nadie lo
  // pidiera.
  //
  // Se escribe en un efecto y no en el render porque un ref no se toca durante
  // el render: la regla de React lo dice, y tiene razón —escribirlo ahí hace
  // que el render tenga un efecto secundario, y con el doble render de
  // `StrictMode` el resultado depende del orden de los renders.
  useEffect(() => {
    ref.current = manejador;
  });

  useEffect(
    () =>
      registrarAtajo(() => {
        ref.current();
      }),
    []
  );
}

function registrarAtajo(manejador: Manejador): () => void {
  manejadores.push(manejador);
  return () => {
    const i = manejadores.indexOf(manejador);
    if (i >= 0) manejadores.splice(i, 1);
  };
}

/**
 * Ejecuta el atajo sobre el manejador que manda.
 *
 * Si no hay ninguno —el `Header` todavía no ha montado, o la página no tiene
 * buscador— no hace nada. No es un error: el atajo no tiene a quién avisar.
 */
export function ejecutarAtajo(): void {
  const manejador = manejadores[manejadores.length - 1];
  if (manejador) manejador();
}
