import { ventanaDelDia } from "@/lib/promo";

/**
 * La ventana de cada día, y la tabla entera.
 *
 * **Por qué los siete días y no los tres que publican.** Un cron que solo se configura
 * para jueves, viernes y sábado es tres entradas en Dokploy que hay que mantener, y el
 * día que una falla nadie se entera. Con uno diario, lo que decide si hay publicación es
 * una tabla del calendario, y una tabla se prueba.
 *
 * **El domingo es `null` a propósito, y es el caso que más conviene mirar.** El sábado se
 * publica el fin de semana entero, así que el domingo volver a publicar mandaría el mismo
 * carrusel dos días seguidos. Aquí la versión anterior devolvía el finde en curso, que
 * era lo correcto cuando solo se publicaba los viernes; con tres ventanas es
 * exactamente el bucle que hay que evitar.
 *
 * **La fecha va como argumento y no como `new Date()` dentro**, o esta tabla no se
 * podría escribir. Es la misma razón por la que `recomendados` recibe `hoy`.
 */
describe("la ventana de cada día", () => {
  /** 2026-10-08 jueves, 09 viernes, 10 sábado, 11 domingo, 12 lunes. */
  const JUEVES = "2026-10-08";
  const VIERNES = "2026-10-09";
  const SABADO = "2026-10-10";
  const DOMINGO = "2026-10-11";
  const LUNES = "2026-10-12";
  const MARTES = "2026-10-13";
  const MIERCOLES = "2026-10-14";

  it("el jueves publica el jueves", () => {
    expect(ventanaDelDia(JUEVES)).toEqual({
      desde: JUEVES,
      hasta: JUEVES,
      etiqueta: "HOY",
    });
  });

  it("el viernes publica el viernes", () => {
    expect(ventanaDelDia(VIERNES)).toEqual({
      desde: VIERNES,
      hasta: VIERNES,
      etiqueta: "HOY",
    });
  });

  it("el sábado publica el fin de semana entero", () => {
    expect(ventanaDelDia(SABADO)).toEqual({
      desde: SABADO,
      hasta: DOMINGO,
      etiqueta: "ESTE FINDE",
    });
  });

  it("el domingo no publica, porque el sábado ya publicó ese fin de semana", () => {
    expect(ventanaDelDia(DOMINGO)).toBeNull();
  });

  it("lunes, martes y miércoles tampoco", () => {
    expect(ventanaDelDia(LUNES)).toBeNull();
    expect(ventanaDelDia(MARTES)).toBeNull();
    expect(ventanaDelDia(MIERCOLES)).toBeNull();
  });

  it("cruza el cambio de mes sin inventarse un día", () => {
    // El 31 de octubre de 2026 es sábado: el domingo siguiente es el 1 de noviembre.
    expect(ventanaDelDia("2026-10-31")).toEqual({
      desde: "2026-10-31",
      hasta: "2026-11-01",
      etiqueta: "ESTE FINDE",
    });
  });

  it("una fecha que no parsea lanza en vez de devolver null", () => {
    // **Este es el que no puede devolver `null`.** Un `null` aquí significa "hoy no se
    // publica", que es una respuesta correcta y silenciosa; una fecha rota tiene que ser
    // un error, porque si no el cron se creería que hoy no toca y saldría con 0 sin
    // mandar nada, tres viernes seguidos sin que nadie lo note.
    expect(() => ventanaDelDia("no-es-una-fecha")).toThrow(/no-es-una-fecha/);
  });

  it("son tres días de publicación en siete, ni uno más ni uno menos", () => {
    // La cuenta es la comprobación de que la tabla de arriba no tiene un día de más o de
    // menos: es la forma de que un `return null` que se cuele no pase desapercibido.
    const siete = [
      JUEVES, VIERNES, SABADO, DOMINGO, LUNES, MARTES, MIERCOLES,
    ];
    const publican = siete.filter((d) => ventanaDelDia(d) !== null);

    expect(publican).toEqual([JUEVES, VIERNES, SABADO]);
  });
});