/**
 * `lib/digest.ts`: el mensaje que sale a **toda la lista de suscriptores**.
 *
 * Lo que se prueba aquí es una cosa muy estrecha y a la vez la más grave del
 * repo: que el digest no afirme lo que no sabe. Un "Hoy no hay eventos en
 * Vitoria-Gasteiz" es una afirmación sobre el mundo, y hay dos maneras muy
 * distintas de que la agenda venga vacía —un martes de enero, o las fuentes
 * caídas— y solo una de las dos permite mandarlo.
 *
 * Y antes no había diferencia entre las dos: `buildDailyDigest` devolvía el digest
 * "no hay eventos" siempre que el agregado viniera vacío, el scheduler lo mandaba a
 * todo el mundo y `markDigestSent()` quemaba el día. El que se lo creía era el
 * usuario, no un panel, así que un día con fuentes caídas se anunciaba como un
 * martes sin planes y sin reintento posible.
 */

const SALUD_SANA = {
  scrapedAt: "",
  sourcesTotal: 37,
  sourcesOk: 37,
  sourcesFallidas: [] as { id: string; error: string }[],
};

async function digestCon(
  eventos: unknown[],
  salud: Partial<typeof SALUD_SANA> = {}
): Promise<Awaited<ReturnType<typeof import("@/lib/digest").buildDailyDigest>>> {
  jest.resetModules();
  jest.doMock("@/lib/agenda", () => ({
    getAgendaEventos: jest.fn(async () => eventos),
    getAgendaSalud: jest.fn(async () => ({ ...SALUD_SANA, ...salud })),
  }));
  const { buildDailyDigest } = await import("@/lib/digest");
  return buildDailyDigest();
}

afterEach(() => {
  jest.dontMock("@/lib/agenda");
  jest.restoreAllMocks();
});

describe("con eventos", () => {
  it("los cuenta y los titula", async () => {
    const payload = await digestCon([
      { title: "Concierto en el Windsor", slug: "concierto-windsor" },
      { title: "Teatro en el Principal", slug: "teatro-principal" },
    ]);

    expect(payload).not.toBeNull();
    expect(payload?.title).toBe("2 eventos hoy en Vitoria-Gasteiz");
    expect(payload?.body).toContain("Windsor");
    expect(payload?.url).toBe("/evento/concierto-windsor");
  });
});

describe("sin eventos, y sin poder saber por qué", () => {
  it("no afirma nada si cayó una fuente que no es tolerable", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);

    const payload = await digestCon([], {
      sourcesOk: 36,
      sourcesFallidas: [{ id: "vam", error: "500" }],
    });

    expect(payload).toBeNull();
  });

  it("no afirma nada si se ha perdido más de la mitad del agregado", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);

    const payload = await digestCon([], {
      sourcesOk: 10,
      sourcesFallidas: [{ id: "rula", error: "500" }],
    });

    expect(payload).toBeNull();
  });

  it("avisa por consola de qué se trata, porque el silencio no sirve de nada", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    await digestCon([], {
      sourcesOk: 36,
      sourcesFallidas: [{ id: "vam", error: "500" }],
    });

    expect(errorSpy).toHaveBeenCalledWith(expect.stringMatching(/vam/));
  });
});

describe("sin eventos, y la agenda sí es de fiar", () => {
  it("afirma que no hay eventos, porque eso es lo que sabe", async () => {
    // Un martes de enero con 37 fuentes sanas. El digest es correcto y **útil**:
    // es el caso para el que existe la función, y filtrarlo sería tirar el digest
    // de todos los días flojos del año.
    const payload = await digestCon([]);

    expect(payload).not.toBeNull();
    expect(payload?.body).toContain("no hay eventos");
  });

  it("solo cae una tolerable y el digest sale igual", async () => {
    /*
     * El otro lado de la decisión, y el que evita que el digest deje de salir nunca.
     *
     * `rula` es la única tolerable porque es la única con credencial. Si perderla
     * suspendiera el digest, volveríamos al problema de siempre: una dependencia de
     * un tercero decidiendo que los suscriptores no se enteran de nada. Con solo
     * tolerables caídas sale un digest corto y verdadero, que es mejor que un
     * digest mentiroso y también mejor que nada.
     */
    const payload = await digestCon(
      [{ title: "Lo que sí hay", slug: "lo-que-si-hay" }],
      { sourcesOk: 36, sourcesFallidas: [{ id: "rula", error: "500" }] }
    );

    expect(payload).not.toBeNull();
    expect(payload?.body).toContain("Lo que sí hay");
  });

  it("solo cae una tolerable y tampoco hay eventos: sale el de verdad", async () => {
    // El caso que cierra el círculo: vacía **y** con `rula` caída sigue siendo un
    // "no hay eventos" defendible, porque las otras 36 responden.
    const payload = await digestCon([], {
      sourcesOk: 36,
      sourcesFallidas: [{ id: "rula", error: "500" }],
    });

    expect(payload).not.toBeNull();
    expect(payload?.body).toContain("no hay eventos");
  });
});