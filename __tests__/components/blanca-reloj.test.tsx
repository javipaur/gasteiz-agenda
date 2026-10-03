/**
 * @jest-environment jsdom
 */

/**
 * `FiestasBlancaSection` leía el reloj **en el cuerpo del render**, y eran dos fallos
 * en una línea.
 *
 * La línea era el filtro de los próximos:
 *
 *     .filter((f) => f.date >= new Date().toISOString().slice(0, 10))
 *
 * 1. **Impureza en render.** El valor se calculaba en cada render y no estaba en
 *    ninguno. En `HeroSection` y en `NextDaysSection` el mismo fallo se agravaba
 *    porque el `Date.now()` estaba **dentro** de un `useMemo`, y un memo impuro puede
 *    devolver su valor cacheado indefinidamente: dejar la pestaña abierta cruzando la
 *    medianoche seguía puntuando contra el día con el que se calculó la primera vez.
 *    Aquí la lista se recalculaba, así que el daño es "puede verse un día que no es el
 *    que se está mirando", que es el mismo defecto en su versión más barata.
 * 2. **UTC para una fecha local.** El día que ve la persona es el local, y el prefijo
 *    ISO es el de UTC. Entre las 00:00 y las 01:59 de Europe/Madrid el día local ya ha
 *    cambiado y el del prefijo todavía no, porque el primero en cruzar la medianoche es
 *    el UTC —a las 23:00Z en invierno y a las 22:00Z en verano—. Medido en
 *    `TZ=Europe/Madrid`:
 *
 *         instante (Z)          toISOString()   día local Madrid
 *         2027-03-15T22:30Z     2027-03-15     2027-03-15
 *         2027-03-15T23:30Z     2027-03-15     2027-03-16   <-- ventana
 *         2027-07-15T22:30Z     2027-07-15     2027-07-16   <-- ventana
 *
 * El arreglo es el patrón que ya está en la home y en los ficheros de al lado: el
 * instante llega como prop `ahora` desde el componente de servidor, y el día se saca
 * con `localDateStr`, la misma función que usa `NextDaysSection`. Ninguna copia del
 * reloj en el render, y "el día que ve el usuario" con una sola definición.
 *
 * Un detalle que se corrigió de paso y que no estaba en la lista: el año del título
 * salía de un segundo `new Date().getFullYear()` en el mismo cuerpo. Dejarlo habría
 * sido purificar el componente a medias, que es peor que no purificarlo: "a veces el
 * render es determinista" no es una propiedad útil.
 */
import { escenario } from "../helpers-a11y";

type Modulo = { default: (props: Record<string, unknown>) => unknown };

/** Las 00:30 del 16 de marzo de 2027 en Madrid, que son las 23:30Z del 15. */
const MEDIANOCHE_MADRID = new Date("2027-03-15T23:30:00Z");

/** Una fiesta tal y como la devuelve `scrapeFiestasBlanca`. */
function fiesta(id: string, title: string, date: string) {
  return {
    id,
    title,
    date,
    dateEnd: "",
    timeStart: "",
    timeEnd: "",
    location: "Plaza de la Virgen Blanca",
    url: `https://www.gasteizhoy.com/${id}`,
    image: "",
    target: "",
    dayWeek: "",
    cancelled: false,
    category: "Fiestas",
  };
}

describe("FiestasBlancaSection", () => {
  beforeEach(() => {
    // Sin esto el reloj real decide la zona horaria pero no la hora del día, que es
    // justo lo que mete al instante dentro o fuera de la ventana. Los instantes que
    // se pasan van escritos en cada caso, así que el test no depende de cuándo se
    // corra.
    jest.useFakeTimers({ doNotFake: ["setTimeout", "setInterval", "setImmediate"] });
    jest.setSystemTime(MEDIANOCHE_MADRID);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("el instante elegido está de verdad en la ventana de las dos horas", () => {
    // Guarda de los dos casos siguientes: si el reloj no estuviera en la ventana,
    // pasarían sin medir lo que dicen medir.
    expect(MEDIANOCHE_MADRID.toISOString().slice(0, 10)).toBe("2027-03-15");
    expect(MEDIANOCHE_MADRID.getHours()).toBe(0);
  });

  it("descarta la fiesta de ayer local y pinta la de hoy local", () => {
    // Falla con el código viejo: el filtro comparaba contra `2027-03-15` —el día
    // UTC—, así que la fiesta de ayer se colaba y la de hoy entraba por el borde. Con
    // el día local, ayer se descarta y hoy sigue entrando.
    const { crear, montar, conProviders, modulo } = escenario<Modulo>(
      "@/app/components/FiestasBlancaSection"
    );

    const vista = montar(
      conProviders(
        crear(modulo.default, {
          ahora: MEDIANOCHE_MADRID.getTime(),
          fiestas: [fiesta("ayer", "Vaquillas del día anterior", "2027-03-15"),
            fiesta("hoy", "Concierto de hoy", "2027-03-16")],
        })
      )
    );

    expect(vista.texto()).toContain("Concierto de hoy");
    expect(vista.texto()).not.toContain("Vaquillas del día anterior");

    vista.desmontar();
  });

  it("el instante llega por prop, no se lee en el cuerpo del render", () => {
    // Esta es la mitad del defecto que no es de huso, y la que no se ve: con el
    // código viejo, re-renderizar con otro `ahora` **no cambia nada**, porque el
    // componente nunca mira el prop. Aquí el mismo árbol, con el mismo reloj de
    // sistema, se pinta dos veces y lo único que cambia es el instante que se le pasa.
    //
    // La fiesta va fechada el 15 porque el filtro es `>= hoy`: avanzar `ahora` es lo
    // único que puede hacer que una lista se vacíe, y eso es justo lo que hay que ver.
    const { crear, montar, conProviders, modulo } = escenario<Modulo>(
      "@/app/components/FiestasBlancaSection"
    );

    const nodo = (ahora: Date) =>
      conProviders(
        crear(modulo.default, {
          ahora: ahora.getTime(),
          fiestas: [fiesta("hoy", "Vaquillas del día 15", "2027-03-15")],
        })
      );

    const vista = montar(nodo(new Date(2027, 2, 15, 12, 0, 0)));
    expect(vista.texto()).toContain("Vaquillas del día 15");

    // Al llegar al 16 esa fiesta ya pasó y la sección se vacía. Con el código viejo
    // las dos pasadas son idénticas, porque las dos leen el mismo `new Date()`.
    vista.render(nodo(new Date(2027, 2, 16, 12, 0, 0)));
    expect(vista.texto()).not.toContain("Vaquillas del día 15");

    vista.desmontar();
  });

  it("el año del título sale del prop y no de un segundo `new Date()`", () => {
    // El mismo defecto en la línea de al lado: el año del `<h2>` venía de
    // `new Date().getFullYear()`, un segundo reloj en el cuerpo del mismo componente.
    // Dejarlo ahí lo deja impuro a medias, que es peor que no purificarlo.
    //
    // El `?? new Date(ahora).getFullYear()` solo se alcanza cuando **ninguna** fecha
    // de la lista trae un año legible, y para llegar hasta él hace falta una fiesta
    // que pase el filtro sin fecha válida: el filtro es una comparación de cadenas, y
    // "sin-fecha" > "2027-03-16" porque `'s'` va después de `'2'`. Ese es un
    // defecto aparte y **no** se arregla aquí —lo que se comprueba es que el año que
    // sale en ese camino sale del prop.
    const { crear, montar, conProviders, modulo } = escenario<Modulo>(
      "@/app/components/FiestasBlancaSection"
    );

    const vista = montar(
      conProviders(
        crear(modulo.default, {
          ahora: new Date(2028, 2, 16, 12, 0, 0).getTime(),
          fiestas: [fiesta("sin-anio", "Vaquillas", "sin-fecha")],
        })
      )
    );

    expect(vista.texto()).toContain("La Blanca 2028");

    vista.desmontar();
  });

  it("sin fiestas por pasar no pinta nada, ni con el reloj más adelantado", () => {
    // El caso de que la sección desaparezca entera: si el filtro dejara pasar algo, la
    // home mostraría una rejilla con una fiesta ya pasada. Con el código viejo, entre
    // las 00:00 y las 01:59 esto era justo lo que pasaba con la fiesta de ayer.
    const { crear, montar, conProviders, modulo } = escenario<Modulo>(
      "@/app/components/FiestasBlancaSection"
    );

    const lista = Array.from({ length: 20 }, (_, i) =>
      fiesta(`pasada-${i}`, `Fiesta pasada ${i}`, "2027-03-15")
    );

    const vista = montar(
      conProviders(
        crear(modulo.default, { ahora: MEDIANOCHE_MADRID.getTime(), fiestas: lista })
      )
    );

    expect(vista.texto()).not.toContain("Fiesta pasada");

    vista.desmontar();
  });
});