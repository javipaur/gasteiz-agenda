import { loadFixture, mockFetchWith } from "../helpers";
import { scrapeMunicipalCalendar } from "@/lib/sources/municipal";

describe("scrapeMunicipalCalendar", () => {
  it("parses the CalendarioServlet JSON response", async () => {
    const json = loadFixture("municipal-response.json");

    const fetchMock = mockFetchWith([
      { match: /vitoria-gasteiz\.org/, content: json },
    ]);

    const events = await scrapeMunicipalCalendar();

    expect(fetchMock).toHaveBeenCalled();
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);

    for (const e of events) {
      expect(typeof e.title).toBe("string");
      expect(typeof e.date).toBe("string");
      expect(typeof e.link).toBe("string");
    }
  });

  it("maps extra fields (time, dateEnd, cancelled, audience)", async () => {
    const json = loadFixture("municipal-response.json");

    mockFetchWith([{ match: /vitoria-gasteiz\.org/, content: json }]);

    const events = await scrapeMunicipalCalendar();
    const e = events[0];

    expect(e).toMatchObject({
      title: 'Exposición: "Tierra y Cielo"',
      date: "2026-09-16T06:30Z",
      time: "08:30",
      dateEnd: "2026-09-16",
    });
    expect(e.cancelled).toBeUndefined();
    expect(e.description).toBeUndefined();
  });

  it("maps cancelled events and non-generic audiences", async () => {
    const json = loadFixture("municipal-response.json").replace(
      '"Tierra y Cielo"',
      '"Otra Expo"'
    );
    const custom = json.replace(
      '"isCancelado":false',
      '"isCancelado":true'
    ).replace(
      '"destinatario":"Todos los públicos",',
      '"destinatario":"Público infantil",'
    );

    mockFetchWith([{ match: /vitoria-gasteiz\.org/, content: custom }]);

    const events = await scrapeMunicipalCalendar();
    const e = events[0];

    expect(e.cancelled).toBe(true);
    expect(e.description).toBe("Público infantil");
  });

  it("transforms smart image URLs", async () => {
    const json = loadFixture("municipal-response.json");

    mockFetchWith([
      { match: /vitoria-gasteiz\.org/, content: json },
    ]);

    const events = await scrapeMunicipalCalendar();
    for (const e of events) {
      if (e.image) {
        expect(e.image.startsWith("https://www.vitoria-gasteiz.org")).toBe(true);
      }
    }
  });

  it("el calendario 392 sale con su calendariosID en la URL", async () => {
    // El 392 es la red de teatros de los centros cívicos y no aparece en el
    // `tipo: [13]` de arriba. Lo que ata la entrada `municipal-teatros` del registro
    // es **la URL**, no el resultado: si alguien cambia el id y el calendario
    // empieza a devolver la agenda general, la prueba seguiría viendo "eventos" y
    // no fallaría. Mirando el id que se pidió, sí.
    //
    // Medido contra el sitio el 4 de octubre de 2026: 46 eventos en los doce meses
    // siguientes, convenues en el Félix Petite (23), Matauco (15), Lorca (2), Aldabe
    // (2) y el Palacio de Congresos (1). De ellos, 36 no salen en la página 1 del
    // calendario 196.
    mockFetchWith([
      { match: /vitoria-gasteiz\.org/, content: loadFixture("municipal-response.json") },
    ]);

    await scrapeMunicipalCalendar({ calendariosID: 392 });

    const llamada = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(llamada).toContain("calendariosID=392");
    expect(llamada).toContain("accion=buscar");
  });

it("el filtro `tipo` viaja en la URL", async () => {
    // Lo que ata una variante del registro al calendario que quiere es **la URL**,
    // no el resultado: si el `tipo` no llegara, la prueba seguiría viendo "eventos"
    // —el fixture responde igual— y no fallaría. Mirando la petición, sí.
    //
    // La lección de por qué esto importa tanto está en
    // `__tests__/source-registry.test.ts`: `municipal-visitas` se filtraba con
    // `tipo: ["visitias guiadas"]`, el servlet solo acepta números, y la entrada
    // llevaba meses devolviendo cero sin que nada lo dijera. Aquí se mira el
    // camino; allí se prohíbe el que no funciona.
    mockFetchWith([
      { match: /vitoria-gasteiz\.org/, content: loadFixture("municipal-response.json") },
    ]);

    await scrapeMunicipalCalendar({ tipo: [15] });
    await scrapeMunicipalCalendar({ dest: ["infantil"] });

    const llamadas = (global.fetch as jest.Mock).mock.calls.map((c) => c[0] as string);
    // El `f` va crudo en la query, sin `encodeURIComponent`: `fetchMunicipalCalendar`
    // lo concatena tal cual. Por eso el filtro se lee en la URL tal y como sale.
    //
    // Y se busca por filtro y no por posición porque una consulta puede partirse en
    // varias peticiones: el fixture trae 111 filas, que es más de `FILAS_SOSPECHOSAS`,
    // así que desde la paginación cada `scrapeMunicipalCalendar` puede ser una llamada
    // o catorce. "La petición que lleva este filtro" es lo que el test quería decir
    // siempre; "la segunda llamada" solo lo era cuando todo cabía en una.
    const porTipo = llamadas.find((u) => u.includes('"tipo":[15]'));
    const porDest = llamadas.find((u) => u.includes('"dest":["infantil"]'));
    expect(porTipo).toContain('&f={"tipo":[15]}');
    expect(porDest).toContain('&f={"dest":["infantil"]}');
  });

  it("propaga el fallo HTTP en vez de devolver una lista vacía", async () => {
    // Devolver `[]` es indistinguible de "hoy no hay nada", y esta es la fuente
    // de `priority: 0`, la que gana todos los dedupes: un 502 del Ayuntamiento
    // vaciaba la agenda municipal entera con HTTP 200 y sin una sola línea de
    // log, porque `agenda.ts` solo registra `scraping_failed` en las promesas que
    // **rechazan**. Por eso propaga, igual que `scrapeBuscametasInscripciones`.
    mockFetchWith([
      { match: /vitoria-gasteiz\.org/, content: "", status: 502 },
    ]);

    await expect(scrapeMunicipalCalendar()).rejects.toThrow(/502/);
  });

  it("el estado del fallo viaja en el mensaje, no solo el texto", async () => {
    // `agenda.ts:107` loguea `result.reason.message`. Sin el estado, un 502 y un
    // 404 salen igual en el panel y no hay forma de saber si es caída del
    // Ayuntamiento o un cambio de URL.
    mockFetchWith([
      { match: /vitoria-gasteiz\.org/, content: "", status: 404 },
    ]);

    await expect(scrapeMunicipalCalendar()).rejects.toThrow(/404/);
  });

  it("repite la consulta mes a mes cuando la ventana anual satura", async () => {
    // El defecto, medido el 6 de octubre de 2026: `CalendarioServlet` corta a unos 50
    // resultados. Una ventana de 12 meses devuelve 50, el resto se pierde, y no hay
    // ningún error ni ningún log que lo diga.
    //
    // El doble devuelve 50 en la ventana anual y 1 por mes. Esa es la forma real del
    // problema: la consulta anual parece que funciona, y por eso el rojo no llegaba
    // nunca a ninguna parte.
    const anual = Array.from({ length: 50 }, (_, i) => ({
      codigo: `a${i}`,
      titulo: `Anual ${i}`,
      fechaInicio: "20261015",
      datetime: "2026-10-15T00:00:00.000Z",
    }));
    const mensual = (mes: number) => ({
      codigo: `m${mes}`,
      titulo: `Mensual ${mes}`,
      fechaInicio: `2026${String(mes).padStart(2, "0")}15`,
      datetime: `2026-${String(mes).padStart(2, "0")}-15T00:00:00.000Z`,
    });

    mockFetchWith([
      {
        match: /vitoria-gasteiz\.org/,
        content: (url) => {
          const p = new URL(url).searchParams;
          const dias = (Number(p.get("fh")) - Number(p.get("fd"))) / 86400000;
          if (dias > 200) return JSON.stringify({ actividades: { resultados: anual } });
          const mes = new Date(Number(p.get("fd"))).getMonth() + 1;
          return JSON.stringify({ actividades: { resultados: [mensual(mes)] } });
        },
      },
    ]);

    const eventos = await scrapeMunicipalCalendar();
    const llamadas = (global.fetch as jest.Mock).mock.calls.map((c) => {
      const p = new URL(String(c[0])).searchParams;
      return (Number(p.get("fh")) - Number(p.get("fd"))) / 86400000;
    });

    // Una sola petición anual, y luego una por mes.
    expect(llamadas.filter((dias) => dias > 200)).toHaveLength(1);
    expect(llamadas.filter((dias) => dias <= 200).length).toBeGreaterThanOrEqual(12);

    // Y lo que se queda son los mensuales, no los de la anual: si se devolvieran los
    // dos, la paginación no habría servido de nada.
    expect(eventos.filter((e) => e.title.startsWith("Anual"))).toHaveLength(0);
    expect(eventos.filter((e) => e.title.startsWith("Mensual")).length).toBeGreaterThanOrEqual(12);
  });

  it("parte en dos una ventana que también satura", async () => {
    // El segundo nivel existe porque hay un tramo del calendario que trae más de 45
    // cosas y todavía no se sabe cuál es. Con el nivel 0 partiendo por meses, un día
    // cargado se quedaría a medias, y aquí se ve que se parte.
    //
    // **El umbral del doble es `20` y no `10`, y es aritmética, no gusto.** El segundo
    // nivel parte el mes por la mitad, así que la hoja más estrecha que llega al servlet
    // son 16 días: con un umbral de 10 este test no podría ponerse verde con el tope en
    // 2, y para llegar a diez días desde un mes de treinta hay que partir tres veces —
    // mes, mitad y cuarto—, que son 86 peticiones por entrada en vez de las 38 que
    // mide este tope. El 20 está en mitad de camino entre las dos cosas que el servlet
    // ve: las ventanas de mes van de 28 a 31 días y las mitades de 14 a 16, así que
    // ninguna se confunde con ninguna de las dos.
    const de = (n: number, prefijo: string) =>
      JSON.stringify({
        actividades: {
          resultados: Array.from({ length: n }, (_, i) => ({
            codigo: `${prefijo}${i}`,
            titulo: `${prefijo} ${i}`,
            fechaInicio: "20261015",
            datetime: "2026-10-15T00:00:00.000Z",
          })),
        },
      });

    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    mockFetchWith([
      {
        match: /vitoria-gasteiz\.org/,
        content: (url) => {
          const p = new URL(url).searchParams;
          const dias = (Number(p.get("fh")) - Number(p.get("fd"))) / 86400000;
          if (dias > 200) return de(50, "Anual");
          if (dias > 20) return de(50, "Mes");
          return de(5, "Mitad");
        },
      },
    ]);

    const eventos = await scrapeMunicipalCalendar();

    expect(eventos.filter((e) => e.title.startsWith("Anual"))).toHaveLength(0);
    expect(eventos.filter((e) => e.title.startsWith("Mes"))).toHaveLength(0);
    // Y hay algo de las mitades, que es lo que demuestra que se llegó al segundo nivel.
    expect(eventos.filter((e) => e.title.startsWith("Mitad")).length).toBeGreaterThan(0);

    // **El aviso es parte del contrato, no un adorno.** Si el segundo nivel se abre y
    // trunca un mes sin decir nada, estamos otra vez en el fallo que la paginación vino a
    // arreglar, y encima pagando más peticiones por ello. Borrar el `console.warn` entero
    // dejaba esta suite en verde: eso lo hacía el primer sitio donde alguien iba a tocar
    // sin querer, y por eso está comprobado aquí. El mensaje se mira por dentro porque
    // el calendario y el rango son lo único que dice dónde hay que mirar.
    const avisos = warn.mock.calls.map((c) => String(c[0]));
    expect(avisos.length).toBeGreaterThan(0);
    expect(avisos.some((m) => m.includes("municipal calendar truncado"))).toBe(true);
    expect(avisos.some((m) => m.includes("calendariosID=196"))).toBe(true);
    expect(avisos.some((m) => /\d{4}-\d{2}-\d{2}\.\.\d{4}-\d{2}-\d{2}/.test(m))).toBe(true);

    warn.mockRestore();
  });

  it("las ventanas de mes teselan el rango, sin huecos ni solapes", async () => {
    // La aserción que faltaba, y es la que sostiene la paginación entera: si las
    // ventanas no cubren `[fd, fh]` de punta a punta, los días que se pierden no se
    // pierden en el log, se pierden en la agenda. Y como se perdió dos veces sin que
    // nada lo dijera —`while (d.getTime() + 7 * 86400000 < fh)` dejaba sin pedir el
    // último día, y `out.push([d.getTime() + 86400000, ...])` perdía hoy— este test
    // comprueba las tres cosas: que la primera ventana empieza en el `fd` que se pidió,
    // que la última acaba en el `fh` que se pidió, y que cada ventana arranca donde
    // acabó la anterior.
    //
    // El doble devuelve muchas filas **solo en la ventana del año**, y una por mes, para
    // que la lista de llamadas sean exactamente la ventana original y sus trece meses: si
    // los meses vinieran llenos, el segundo nivel se sumaría en medio y esta lista ya no
    // sería la de las ventanas de mes.
    const de = (n: number) =>
      JSON.stringify({
        actividades: {
          resultados: Array.from({ length: n }, (_, i) => ({
            codigo: `t${i}`,
            titulo: `T ${i}`,
            fechaInicio: "20261015",
            datetime: "2026-10-15T00:00:00.000Z",
          })),
        },
      });

    mockFetchWith([
      {
        match: /vitoria-gasteiz\.org/,
        content: (url) => {
          const p = new URL(url).searchParams;
          const dias = (Number(p.get("fh")) - Number(p.get("fd"))) / 86400000;
          return de(dias > 200 ? 50 : 1);
        },
      },
    ]);

    await scrapeMunicipalCalendar();

    const ventanas = (global.fetch as jest.Mock).mock.calls.map((c) => {
      const p = new URL(String(c[0])).searchParams;
      return [Number(p.get("fd")), Number(p.get("fh"))] as const;
    });
    const original = ventanas[0];
    const meses = ventanas.slice(1);

    expect(meses.length).toBeGreaterThanOrEqual(12);

    // Extremo izquierdo: el primer día del rango no se pierde.
    expect(meses[0][0]).toBe(original[0]);
    // Extremo derecho: el último día del rango no se pierde.
    expect(meses[meses.length - 1][1]).toBe(original[1]);
    // Y en medio: cada ventana arranca donde acabó la anterior, sin huecos y sin solapes.
    for (let i = 1; i < meses.length; i++) {
      expect(meses[i][0]).toBe(meses[i - 1][1]);
    }
  });

  describe("un calendario vacío", () => {
    /*
     * **Cero resultados es un dato por debajo de una semana y una avería por encima, y el
     * umbral sale de un caso medido.**
     *
     * El 13 de octubre de 2026 el servlet respondió HTTP 200 con `numResultados: 0` para
     * un mes y con 340 para otro calendario del mismo sitio, en la misma llamada. El
     * calendario no estaba colgado. Con cero resolviéndose como lista vacía, los 17
     * registros `municipal-*` quedaban vacíos **sin una línea de log** y la salud decía que
     * todo estaba bien.
     */
    it("un rango corto en cero es un dato y devuelve lista vacía", async () => {
      mockFetchWith([{ match: /vitoria-gasteiz\.org/, content: "{}" }]);

      // Un día: un teatro puede no tener nada hoy, y eso no es una avería. `fd` y `fh`
      // son milisegundos, que es lo que espera `CalendarioServlet`.
      const dia = new Date("2026-10-15T12:00:00Z").getTime();
      const eventos = await scrapeMunicipalCalendar({ fd: dia, fh: dia });

      expect(eventos).toEqual([]);
    });

    it("un rango largo en cero lanza, y el mensaje dice el rango", async () => {
      mockFetchWith([{ match: /vitoria-gasteiz\.org/, content: "{}" }]);

      // Tres semanas sin un solo evento, empezando **ayer**: aquí sí es que el calendario
      // no viene, porque el rango empieza ya. **Relativo al reloj**, no escrito a pelo:
      // con fecha fija, dentro de un mes este test empezaría a fallar por estar "lejos"
      // y a medir otra cosa.
      const ayer = Date.now() - 86400000;
      const fd = ayer;
      const fh = ayer + 21 * 86400000;

      await expect(scrapeMunicipalCalendar({ fd, fh })).rejects.toThrow(/calendario vacío/);
    });

    it("pero un calendario estacional puede pedir que el cero sea una respuesta", async () => {
      // La Blanca. Su calendario —`calendariosID=513`— solo tiene eventos la
      // semana grande, y la edición siguiente se publica con meses de
      // antelación. Medido el 20 de octubre de 2026: 59 eventos en el
      // 15jul–12ago de 2026 y **cero** en el mismo tramo de 2027, que es la
      // edición que viene.
      //
      // Ese cero es la respuesta correcta, y sin `permitirVacio` se convertía
      // en un error: el scraper lo devolvía vacío y **La Blanca desaparecía de
      // la agenda sin que nada lo dijera** —la salud seguía en 37/37 porque la
      // fuente no rechazaba, solo devolvía lista vacía—.
      mockFetchWith([{ match: /vitoria-gasteiz\.org/, content: "{}" }]);

      // Las mismas fechas que el caso de arriba, que sí lanza: lo único que
      // cambia es que quien pide dice que su cero es un dato.
      const ayer = Date.now() - 86400000;
      const fd = ayer;
      const fh = ayer + 21 * 86400000;

      await expect(
        scrapeMunicipalCalendar({ fd, fh, permitirVacio: true })
      ).resolves.toEqual([]);
    });

    it("pero un rango lejano en cero no es avería, es la cola", async () => {
      mockFetchWith([{ match: /vitoria-gasteiz\.org/, content: "{}" }]);

// **Este es el caso que apagó la agenda municipal entera, y no lo vi coming.**
      // El 13 de octubre de 2026, con el umbral solo por longitud, cayeron las 17 fuentes
      // `municipal-*` porque cada una mira una ventana distinta: `municipal-teatro` pedía
      // marzo de 2027 y `municipal-exposiciones` enero de 2027.
      //
      // No estaba el calendario roto: se estaba mirando la cola. Medido el mismo día, el
      // calendario 196 tiene 908 eventos en el mes que viene y **36 en el que acaba a los
      // seis meses**. El Ayuntamiento publica con meses de antelación y la cola se vacía
      // sola, así que pedirla da cero sin que haya pasado nada.
      //
      // **La fecha es relativa al reloj del test a propósito.** Escrita a pelo, este test
      // empezaría a fallar en 2027, cuando el rango deje de estar lejos y vuelva a ser
      // una avería de verdad.
      const dentroDeSeisMeses = new Date();
      dentroDeSeisMeses.setMonth(dentroDeSeisMeses.getMonth() + 5);
      const fd = dentroDeSeisMeses.getTime();
      const fh = fd + 30 * 86400000;

      await expect(scrapeMunicipalCalendar({ fd, fh })).resolves.toEqual([]);
    });
  });
});
