import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { dbDePrueba, limpiarDbsDePrueba } from "./helpers-ledger";

/**
 * El agregador y el registro de eventos vistos, juntos.
 *
 * `__tests__/event-ledger.test.ts` prueba el módulo contra su contrato; esto
 * prueba **la costura**: que `aggregateConMeta` anota lo que dice que anota. Un
 * registro impecable que nadie llama no vigila nada, y esa mitad no se ve en los
 * tests del módulo.
 *
 * Tres cosas se fijan aquí, y las tres son decisiones, no detalles:
 *
 * - Se anota la lista **antes del dedupe**. Si solo se anotara el ganador, el día
 *   que dos fuentes publican el mismo plan y la prioridad cambia, el perdedor
 *   aparecería como ausente sin haber desaparecido de ningún sitio.
 * - Una ausencia solo cuenta si la fuente **está sana**. Es la diferencia entre
 *   "este evento se ha ido" y "no he podido preguntar", que es el modo de fallo
 *   que este repo lleva corrigiendo desde el principio.
 * - El registro no puede tumbar la agenda. Es vigilancia, no servicio: si el
 *   volumen no está montado, el peor resultado aceptable es no enterarse, no
 *   dejar de servir.
 */

jest.mock("@/lib/axiom/server", () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

type Agenda = typeof import("@/lib/agenda");
type Ledger = typeof import("@/lib/event-ledger");
type SourceEntry = import("@/lib/source-registry").SourceEntry;
type Logger = { warn: jest.Mock; error: jest.Mock; info: jest.Mock };

let agenda: Agenda;
let ledger: Ledger;
let log: Logger;

/**
 * El registro abre `node:sqlite` y guarda la conexión en una variable de módulo,
 * así que cada caso necesita su propia base **y** recargar los módulos: sin el
 * `resetModules`, la segunda llamada reutilizaría la conexión del primer caso y
 * leería filas que no son suyas.
 *
 * El `logger` se reimporta después de cada recarga por el motivo medido en
 * `__tests__/event-ledger.test.ts`: `jest.mock` reinstancia el módulo mockeado al
 * resetear el registro, así que una referencia cogida antes apuntaría a un objeto
 * al que ya nadie escribe.
 */
async function cargar(): Promise<void> {
  dbDePrueba();
  jest.resetModules();
  log = (await import("@/lib/axiom/server")).logger as unknown as Logger;
  ledger = await import("@/lib/event-ledger");
  agenda = await import("@/lib/agenda");
}

function entry(over: Partial<SourceEntry> & Pick<SourceEntry, "run">): SourceEntry {
  return { id: "test", group: "test", label: "Test", priority: 9, ...over };
}

/** Una fecha futura y fija, para que el caso no se pudra al pasar los meses. */
const FECHA = "2027-03-15T20:00:00.000Z";

const crudo = (title: string, link: string) => ({ title, date: FECHA, link });

afterAll(() => {
  limpiarDbsDePrueba();
});

beforeEach(async () => {
  await cargar();
});

describe("aggregateConMeta anota en el registro", () => {
  it("guarda una fila por fuente aunque el agregado funda los dos eventos en uno", async () => {
    // Es el caso que motivó todo esto: el mismo plan publicado por dos fuentes.
    // El agregado enseña **una** tarjeta; el registro tiene que quedarse con
    // **dos**, porque el día que una de las dos deje de publicarlo hay que poder
    // decirlo sin culpar a la otra.
    const { eventos } = await agenda.aggregateConMeta([
      entry({
        id: "municipal",
        priority: 1,
        run: async () => [crudo("Gazte Film Fest", "https://m.example/a")],
      }),
      entry({
        id: "euskadi",
        priority: 5,
        run: async () => [crudo("Gazte Film Fest", "https://e.example/a")],
      }),
    ]);

    expect(eventos).toHaveLength(1);

    const filas = ledger.leerLedger();
    expect(filas).toHaveLength(2);
    expect(filas.map((f) => f.source).sort()).toEqual(["euskadi", "municipal"]);
    for (const fila of filas) {
      expect(fila.fallos).toBe(0);
    }
  });

  it("anota el evento con su día local y su enlace, no con el id del scraper", async () => {
    await agenda.aggregateConMeta([
      entry({
        id: "municipal",
        run: async () => [crudo("Concierto de prueba", "https://m.example/1")],
      }),
    ]);

    const [fila] = ledger.leerLedger();
    expect(fila.source).toBe("municipal");
    expect(fila.fecha).toBe("2027-03-15");
    expect(fila.link).toBe("https://m.example/1");
    // El id es reconstruible desde la fila: eso es lo que permite reconocer el
    // mismo evento en la importación de mañana sin guardar nada del scraper.
    expect(fila.tracking_id).toBe(
      ledger.trackingId("municipal", FECHA, "Concierto de prueba")
    );
  });

  it("una fuente que responde vacía acumula una ausencia; una que falla, no", async () => {
    // La distinción entera del módulo, vista desde el agregador.
    await agenda.aggregateConMeta([
      entry({
        id: "municipal",
        priority: 1,
        run: async () => [crudo("Uno", "https://m.example/1")],
      }),
      entry({
        id: "euskadi",
        priority: 5,
        run: async () => [crudo("Dos", "https://e.example/2")],
      }),
    ]);

    // Segunda importación: municipal responde con lista vacía (sana, ya no lo
    // publica) y euskadi lanza (no se ha podido preguntar).
    await agenda.aggregateConMeta([
      entry({ id: "municipal", priority: 1, run: async () => [] }),
      entry({
        id: "euskadi",
        priority: 5,
        run: async () => {
          throw new Error("502 del upstream");
        },
      }),
    ]);

    const filas = ledger.leerLedger();
    const municipal = filas.find((f) => f.source === "municipal");
    const euskadi = filas.find((f) => f.source === "euskadi");

    expect(municipal?.fallos).toBe(1);
    // La caída no suma: una fuente que no respondió no dice si el evento se fue.
    expect(euskadi?.fallos).toBe(0);
  });

  it("volver a ver el evento le baja los fallos a cero", async () => {
    const fuente = () =>
      entry({
        id: "municipal",
        run: async () => [crudo("Uno", "https://m.example/1")],
      });

    await agenda.aggregateConMeta([fuente()]);
    await agenda.aggregateConMeta([entry({ id: "municipal", run: async () => [] })]);
    expect(ledger.leerLedger()[0].fallos).toBe(1);

    // Vuelve a publicarlo: la ausencia era temporal y no puede quedar contada.
    await agenda.aggregateConMeta([fuente()]);
    expect(ledger.leerLedger()[0].fallos).toBe(0);
  });

  it("una importación con todas las fuentes caídas no inventa ausencias", async () => {
    await agenda.aggregateConMeta([
      entry({
        id: "municipal",
        run: async () => [crudo("Uno", "https://m.example/1")],
      }),
    ]);

    await agenda.aggregateConMeta([
      entry({
        id: "municipal",
        run: async () => {
          throw new Error("sin red");
        },
      }),
    ]);

    // Nadie pudo preguntar, así que no hay nada que reportar: la fila se queda
    // como estaba y no se acumula una alarma falsa.
    expect(ledger.leerLedger()[0].fallos).toBe(0);
  });
});

describe("el registro no puede tumbar la agenda", () => {
  it("si la base no se puede abrir, sirve los eventos igual y avisa por el log", async () => {
    const dir = dbDePrueba();
    // Un fichero donde el módulo espera un directorio: `mkdirSync` falla y el
    // registro no llega a abrir nada.
    const fichero = join(dir, "soy-un-fichero");
    writeFileSync(fichero, "no soy un directorio");
    process.env.EVENT_LEDGER_DB_DIR = fichero;

    jest.resetModules();
    log = (await import("@/lib/axiom/server")).logger as unknown as Logger;
    agenda = await import("@/lib/agenda");

    const { eventos } = await agenda.aggregateConMeta([
      entry({ id: "municipal", run: async () => [crudo("Uno", "https://m.example/1")] }),
    ]);

    expect(eventos).toHaveLength(1);
    expect(log.warn).toHaveBeenCalledWith(
      "event_ledger_failed",
      expect.objectContaining({ error: expect.any(String) })
    );
  });
});
