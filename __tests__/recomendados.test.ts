import { recomendados, LIMITE_POR_DEFECTO } from "@/lib/recomendados";
import type { Evento } from "@/lib/eventos";

/**
 * Qué va en una lista de recomendados, que es el mismo criterio para la home, para
 * `/hoy` y para el paquete de redes.
 *
 * **Las fechas son de 2030 y no de hoy, y no es por legibilidad.** `scoreEvento` da
 * puntos por cercanía —hasta 20 para lo que está hoy—, así que un evento de 2030
 * puntúa distinto al de hoy mismo. Fijarlas en el futuro quita esa variable y deja
 * que cada caso declare lo que de verdad está probando.
 */

/**
 * Un evento de los que el test construye a mano. `corrobora` es opcional a propósito.
 *
 * **La imagen viene por defecto y eso no es decoration.** El selector descarta lo que
 * no la tiene —una tarjeta sin foto es una letra sobre un rectángulo—, así que un
 * `ev()` sin imagen sale siempre con la lista vacía y cuatro de estos casos pasarían a
 * comprobar el filtro de la imagen sin quererlo. El único caso que la quita a
 * propósito es el que dice que la quita.
 */
const ev = (over: Partial<Evento> = {}): Evento => ({
  id: "e1",
  slug: "e1",
  title: "Evento",
  date: "2030-05-01T20:00:00.000Z",
  image: "https://www.vitoria-gasteiz.org/c.jpg",
  location: "Sala",
  link: "/e1",
  category: "Teatro",
  source: "municipal-teatro",
  ...over,
});

const HOY = new Date(2030, 4, 1, 12, 0, 0);

describe("recomendados", () => {
  it("devuelve los que están en la ventana y ninguno fuera", () => {
    const lista = recomendados(
      [
        ev({ id: "hoy", date: "2030-05-01T20:00:00.000Z" }),
        ev({ id: "manana", date: "2030-05-02T20:00:00.000Z" }),
        ev({ id: "ayer", date: "2030-04-30T20:00:00.000Z" }),
        ev({ id: "dentroDeUnMes", date: "2030-06-01T20:00:00.000Z" }),
      ],
      { desde: "2030-05-01", hasta: "2030-05-03", hoy: HOY }
    );

    expect(lista.map((e) => e.id).sort()).toEqual(["hoy", "manana"]);
  });

  it("la ventana es inclusiva por los dos extremos", () => {
    // El último día de un post de finde es el domingo entero, no hasta las 00:00 del
    // lunes. Es el detalle que hace que un evento del domingo a las 20:00 no desaparezca
    // del post del domingo, que es justo el día que más gente mira la página.
    const domingo = ev({ id: "domingo", date: "2030-05-05T20:00:00.000Z" });

    const lista = recomendados([domingo], {
      desde: "2030-05-05",
      hasta: "2030-05-05",
      hoy: HOY,
    });

    expect(lista.map((e) => e.id)).toEqual(["domingo"]);
  });

  it("prepone el que más fuentes cuentan, no solo el más pesado", () => {
    // El caso que justifica el módulo: dos eventos del mismo peso y categoría, y el
    // que sale en tres fuentes va primero. Con `scoreEvento` solo, empatarían y
    // mandaría el orden de entrada, que es el orden de los registries.
    //
    // **Los dos a la misma hora, y no a "casi la misma".** La fecha es en UTC y la
    // ventana se cuenta en hora local, así que un `T22:00Z` en este repo es medianoche
    // del día siguiente —`jest.config.ts` fija `TZ=Europe/Madrid`— y el evento se cae
    // de una ventana que termina a las 23:59:59 locales. Con la misma hora, la
    // cercanía de `scoreEvento` es idéntica y la única diferencia que queda es la
    // corroboración, que es justo lo que el caso quiere medir.
    const uno = ev({ id: "uno", corrobora: 1 });
    const tres = ev({ id: "tres", corrobora: 3 });

    const lista = recomendados([uno, tres], {
      desde: "2030-05-01",
      hasta: "2030-05-01",
      hoy: HOY,
    });

    expect(lista.map((e) => e.id)).toEqual(["tres", "uno"]);
  });

  it("la bonificación tiene tope, para que seis fuentes no aplasten al Ayuntamiento", () => {
    // **La aritmética de este caso es lo que fija el bonus, y por eso los números
    // importan.** Los pesos de `lib/popularity.ts` dan 5 a `miniature` y 25 al grupo
    // `municipal`, y los dos eventos puntúan igual por categoría y por cercanía, así
    // que la diferencia la decide solo el bono:
    //
    //   miniature, 6 fuentes:  5 (peso) + 22 (Teatro) + 20 (cercanía) + 3×5 =  62
    //   municipal, 1 fuente:  25 (peso) + 22 (Teatro) + 20 (cercanía)      =  67
    //
    // Con el tope de tres extras el municipal gana. Sin tope serían cinco extras, 25
    // puntos, 72 a 67, y ganaría el que solo está en una página de una sala. Ese es
    // el motivo del tope: la señal dice "esto lo confirman varios sitios", no "esto
    // tiene muchas fuentes".
    const seis = ev({ id: "seis", corrobora: 6, source: "miniature" });
    const municipal = ev({ id: "municipal", corrobora: 1, source: "municipal-conciertos" });

    const conSeis = recomendados([seis, municipal], {
      desde: "2030-05-01",
      hasta: "2030-05-01",
      hoy: HOY,
      limite: 2,
    });

    expect(conSeis.map((e) => e.id)).toEqual(["municipal", "seis"]);
  });

  it("descarta lo que no tiene imagen, como ya hace getPopularEvents", () => {
    // La razón está en `lib/popularity.ts`: una tarjeta sin foto es una letra sobre
    // un rectángulo, y la lista de recomendados es la primera que se mira.
    //
    // `image: undefined` explícito porque el `ev()` de arriba trae imagen por
    // defecto: sin esto el caso probaría que salen los dos.
    const conFoto = ev({ id: "foto" });
    const sinFoto = ev({ id: "sinfoto", image: undefined });

    const lista = recomendados([conFoto, sinFoto], {
      desde: "2030-05-01",
      hasta: "2030-05-01",
      hoy: HOY,
    });

    expect(lista.map((e) => e.id)).toEqual(["foto"]);
  });

  it("un día sin nada devuelve lista vacía, no un relleno", () => {
    expect(
      recomendados([ev({ date: "2030-07-01T20:00:00.000Z" })], {
        desde: "2030-05-01",
        hasta: "2030-05-01",
        hoy: HOY,
      })
    ).toEqual([]);
  });

  it("el límite por defecto son ocho, que es lo que cabe en un carrusel con la portada", () => {
    const muchos = Array.from({ length: 20 }, (_, i) =>
      ev({
        id: `e${i}`,
        date: "2030-05-01T20:00:00.000Z",
        image: "https://www.vitoria-gasteiz.org/c.jpg",
      })
    );

    const lista = recomendados(muchos, { desde: "2030-05-01", hasta: "2030-05-01", hoy: HOY });

    expect(LIMITE_POR_DEFECTO).toBe(8);
    expect(lista).toHaveLength(LIMITE_POR_DEFECTO);
  });

  it("una fecha que no existe devuelve vacío en vez de toda la agenda", () => {
    // El `new Date("no-es-una-fecha")` es `Invalid Date`, y sin el `isNaN` el
    // `d >= desdeDate && d <= hastaDate` daría `false` para todo… por el camino
    // bueno. El fallo real es al revés: una `hasta` mal formada comparada con `>=`
    // deja pasar todo lo que haya. Esto fija que la respuesta es vacía.
    const lista = recomendados([ev({ image: "https://www.vitoria-gasteiz.org/c.jpg" })], {
      desde: "no-es-una-fecha",
      hasta: "2030-05-01",
      hoy: HOY,
    });

    expect(lista).toEqual([]);
  });
});