import { ventanaDelDia } from "@/lib/promo";

/**
 * La ventana de cada día, y la tabla entera.
 *
 * **Por qué los siete días y no los tres que publicaban.** Un cron que solo se configura
 * para jueves, viernes y sábado es tres entradas en Dokploy que hay que mantener, y el
 * día que una falla nadie se entera. Con uno diario, lo que decide si hay publicación es
 * una tabla del calendario, y una tabla se prueba.
 *
 * **Y por qué los siete publican, y no es por tener más entradas.** Los tres días
 * originales eran una decisión editorial para no cansar, con la idea de que el resto de la
 * semana no tenía material. Medida en la agenda del 13 al 26 de octubre, **los catorce
 * días tienen los seis planes completos**: no hay un día flojo, y el veto de cuatro días no
 * respondía a que faltara contenido sino a que sobraran correos.
 *
 * **El domingo ya no repite el sábado.** Con tres ventanas el domingo era `null` porque el
 * sábado había publicado el finde entero y volver a publicar mandaba el mismo carrusel dos
 * días seguidos. Ahora el domingo publica **el domingo**, que es un día distinto con
 * contenido distinto. Ese es el bucle que había que evitar, y por eso no era `null` sino
 * otra fecha.
 *
 * **La fecha va como argumento y no como `new Date()` dentro**, o esta tabla no se podría
 * escribir. Es la misma razón por la que `recomendados` recibe `hoy`.
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

  /** Los mismos siete días, en orden, para las comprobaciones que los recorren enteros. */
  const SIETE_DIAS = [
    JUEVES, VIERNES, SABADO, DOMINGO, LUNES, MARTES, MIERCOLES,
  ];

  /** El rótulo va con la ventana, y casi todos los días son `HOY`. */
  function hoy(fecha: string) {
    return { desde: fecha, hasta: fecha, etiqueta: "HOY" };
  }

  it("el jueves publica el jueves", () => {
    expect(ventanaDelDia(JUEVES)).toEqual(hoy(JUEVES));
  });

  it("el viernes publica el viernes", () => {
    expect(ventanaDelDia(VIERNES)).toEqual(hoy(VIERNES));
  });

  it("el sábado publica el fin de semana entero", () => {
    expect(ventanaDelDia(SABADO)).toEqual({
      desde: SABADO,
      hasta: DOMINGO,
      etiqueta: "ESTE FINDE",
    });
  });

  it("el domingo publica el domingo, y no repite el carrusel del sábado", () => {
    // El caso que más conviene mirar. Con tres ventanas esto era `null`: el sábado ya
    // había publicado el finde entero y el domingo habría mandado lo mismo otro día.
    // Ahora es el domingo, con su propio contenido y su propia `utm`.
    expect(ventanaDelDia(DOMINGO)).toEqual(hoy(DOMINGO));
    expect(ventanaDelDia(DOMINGO)).not.toEqual(ventanaDelDia(SABADO));
  });

  it("lunes, martes y miércoles publican su propio día", () => {
    expect(ventanaDelDia(LUNES)).toEqual(hoy(LUNES));
    expect(ventanaDelDia(MARTES)).toEqual(hoy(MARTES));
    expect(ventanaDelDia(MIERCOLES)).toEqual(hoy(MIERCOLES));
  });

  it("ningún día entre semana reutiliza la ventana del sábado", () => {
    // **La comprobación que hace que "publicar más" no sea "reenviar lo mismo".** Si un día
    // entre semana devolviera la ventana del sábado, saldría el mismo carrusel con la misma
    // `utm` y las estadísticas los contarían como el mismo post.
    const finde = ventanaDelDia(SABADO);
    for (const dia of [DOMINGO, LUNES, MARTES, MIERCOLES, JUEVES, VIERNES]) {
      expect(ventanaDelDia(dia)).not.toEqual(finde);
    }
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
    // un error, porque si no el cron se creería que hoy no toca y saldría con 0 sin mandar
    // nada. Con siete días publicando, ese falso silencio es mucho más caro que antes.
    expect(() => ventanaDelDia("no-es-una-fecha")).toThrow(/no-es-una-fecha/);
  });

  it("son siete días de publicación en siete, ni uno más ni uno menos", () => {
    // La cuenta es la forma de que un `return null` que se cuele no pase desapercibido, y
    // también de que quitar un día de la tabla sea un cambio que se ve en un test rojo.
    const publican = SIETE_DIAS.filter((d) => ventanaDelDia(d) !== null);

    expect(publican).toEqual(SIETE_DIAS);
  });

  it("las siete fechas dan siete ventanas distintas", () => {
    // Cada día una ventana y solo el sábado ocupa dos días. Es lo que hace que cada post
    // tenga su propia `utm_content`: si dos días devolvieran lo mismo, las estadísticas
    // no podrían distinguir un post de otro.
    const ventanas = SIETE_DIAS.map((d) => JSON.stringify(ventanaDelDia(d)));

    expect(new Set(ventanas).size).toBe(7);
  });
});