import { writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  dbDePrueba,
  limpiarDbsDePrueba,
  reutilizarDbDePrueba,
} from "./helpers-ledger";

/**
 * El registro de eventos vistos, contra una base de verdad.
 *
 * Lo que se prueba aquí es lo que un recuento no puede comprobar: que una
 * ausencia solo cuenta si la fuente está sana, que volver a ver un evento le
 * resetea los fallos, y que `primera_vez` **no** se reescribe al reimportar. Son
 * las tres cosas que deciden si un evento desaparecido se reporta o se pierde en
 * silencio, que es exactamente el fallo que este módulo existe para cazar.
 */

jest.mock("@/lib/axiom/server", () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

type Ledger = typeof import("@/lib/event-ledger");
type Logger = { warn: jest.Mock; error: jest.Mock };

let ledger: Ledger;

async function cargar(): Promise<Ledger> {
  dbDePrueba();
  jest.resetModules();
  ledger = await import("@/lib/event-ledger");
  return ledger;
}

const FECHA = "2026-11-19T18:00:00.000Z";

const ev = (source: string, title: string, date = FECHA) => ({
  source,
  title,
  date,
  slug: `${source}-slug`,
  link: `https://example.com/${source}`,
});

afterAll(() => {
  limpiarDbsDePrueba();
});

beforeEach(async () => {
  await cargar();
});

describe("trackingId", () => {
  it("la misma fuente, fecha y título dan el mismo id", () => {
    expect(ledger.trackingId("municipal", FECHA, "Concierto de Niños")).toBe(
      ledger.trackingId("municipal", FECHA, "Concierto de Niños")
    );
  });

  it("dos fuentes distintas no comparten id aunque el evento sea el mismo", () => {
    // A propósito: si dos fuentes publican el mismo concierto, cada una tiene que
    // poder desaparecer por su cuenta. Fundirlas aquí escondería que una de las
    // dos se ha roto, que es justo lo que hay que ver.
    expect(ledger.trackingId("municipal", FECHA, "Concierto")).not.toBe(
      ledger.trackingId("euskadi", FECHA, "Concierto")
    );
  });

  it("dos fechas distintas no comparten id", () => {
    expect(ledger.trackingId("municipal", FECHA, "Concierto")).not.toBe(
      ledger.trackingId("municipal", "2026-11-20T18:00:00.000Z", "Concierto")
    );
  });

  it("los acentos y la puntuación no cambian el id", () => {
    // El id no es el slug que se sirve: es una clave interna, así que se
    // normaliza con `slugify` para que una tilde que una fuente escribe y otra no
    // no convierta el mismo evento en dos.
    expect(ledger.trackingId("municipal", FECHA, "Concierto de Niños")).toBe(
      ledger.trackingId("municipal", FECHA, "concierto de ninos")
    );
    expect(ledger.trackingId("municipal", FECHA, "¡Fiesta!")).toBe(
      ledger.trackingId("municipal", FECHA, "Fiesta")
    );
  });

  it("un título vacío no revienta el id", () => {
    expect(ledger.trackingId("municipal", FECHA, "")).toContain("municipal");
  });
});

describe("registrarImportacion", () => {
  it("da de alta los eventos nuevos con cero fallos", () => {
    const r = ledger.registrarImportacion(
      [ev("municipal", "Uno"), ev("municipal", "Dos")],
      ["municipal"],
      1_000
    );

    expect(r).toEqual({
      importacion: 1,
      vistos: 2,
      ausentes: 0,
      nuevos: 2,
      fuentesSanas: 1,
      fuentesFallidas: 0,
    });
    const filas = ledger.leerLedger();
    expect(filas).toHaveLength(2);
    for (const fila of filas) {
      expect(fila.fallos).toBe(0);
      expect(fila.primera_vez).toBe(1_000);
      expect(fila.ultima_vez).toBe(1_000);
      expect(fila.visto_en).toBe(1);
    }
  });

  it("el número de importación sube en cada llamada", () => {
    expect(ledger.registrarImportacion([ev("municipal", "Uno")], ["municipal"], 1).importacion).toBe(1);
    expect(ledger.registrarImportacion([ev("municipal", "Uno")], ["municipal"], 2).importacion).toBe(2);
  });

  it("reimportar conserva `primera_vez` y mueve `ultima_vez`", () => {
    ledger.registrarImportacion([ev("municipal", "Uno")], ["municipal"], 1_000);
    const r = ledger.registrarImportacion([ev("municipal", "Uno")], ["municipal"], 2_000);

    expect(r.nuevos).toBe(0);
    const [fila] = ledger.leerLedger();
    expect(fila.primera_vez).toBe(1_000);
    expect(fila.ultima_vez).toBe(2_000);
  });

  it("dos eventos con el mismo id en la misma importación cuentan una vez", () => {
    // El agregador entrega la lista **antes** del dedupe, así que dos sesiones del
    // mismo título el mismo día llegan aquí como dos entradas. El alta es la
    // misma fila, y contarla dos veces inflaría `vistos` sin que nada más lo
    // notara.
    const r = ledger.registrarImportacion(
      [ev("municipal", "Uno"), ev("municipal", "Uno")],
      ["municipal"],
      1_000
    );
    expect(r.vistos).toBe(1);
    expect(r.nuevos).toBe(1);
    expect(ledger.leerLedger()).toHaveLength(1);
  });
});

describe("las ausencias", () => {
  it("una ausencia de una fuente sana suma un fallo", () => {
    ledger.registrarImportacion(
      [ev("municipal", "Uno"), ev("euskadi", "Dos")],
      ["municipal", "euskadi"],
      1_000
    );

    // La segunda importación solo ve el de municipal; euskadi sigue sana, así que
    // su evento ausente es una desaparición real y no un hueco de la fuente.
    const r = ledger.registrarImportacion([ev("municipal", "Uno")], ["municipal", "euskadi"], 2_000);

    expect(r.ausentes).toBe(1);
    const ausente = ledger
      .leerLedger()
      .find((f) => f.source === "euskadi")!;
    expect(ausente.fallos).toBe(1);
    expect(ausente.ultima_vez).toBe(1_000);
  });

  it("una ausencia de una fuente caída no cuenta", () => {
    // Es la mitad que hace fiable el registro: si la fuente no respondió, no se
    // sabe si el evento desapareció, y darlo por ausente convertiría cada caída en
    // una alarma falsa sobre cientos de eventos a la vez.
    ledger.registrarImportacion(
      [ev("municipal", "Uno"), ev("euskadi", "Dos")],
      ["municipal", "euskadi"],
      1_000
    );

    const r = ledger.registrarImportacion([ev("municipal", "Uno")], ["municipal"], 2_000);

    expect(r.ausentes).toBe(0);
    expect(ledger.leerLedger().find((f) => f.source === "euskadi")!.fallos).toBe(0);
  });

  it("volver a ver el evento resetea los fallos", () => {
    ledger.registrarImportacion([ev("municipal", "Uno")], ["municipal"], 1_000);
    ledger.registrarImportacion([], ["municipal"], 2_000);
    expect(ledger.leerLedger()[0].fallos).toBe(1);

    ledger.registrarImportacion([ev("municipal", "Uno")], ["municipal"], 3_000);
    expect(ledger.leerLedger()[0].fallos).toBe(0);
  });

  it("una ausencia repetida suma un fallo por importación y no dos", () => {
    ledger.registrarImportacion([ev("municipal", "Uno")], ["municipal"], 1_000);
    ledger.registrarImportacion([], ["municipal"], 2_000);
    const r = ledger.registrarImportacion([], ["municipal"], 3_000);
    expect(r.ausentes).toBe(1);
    expect(ledger.leerLedger()[0].fallos).toBe(2);
  });

  it("confirma ausencia tras ejecuciones sanas consecutivas y la reaparición la reactiva", () => {
    ledger.registrarImportacion([ev("municipal", "Uno")], ["municipal"], 1_000);

    ledger.registrarImportacion([], ["municipal"], 2_000);
    let fila = ledger.leerLedger()[0];
    expect(fila.estado).toBe("ausencia_no_confirmada");
    expect(fila.missing_runs).toBe(1);

    ledger.registrarImportacion([], ["municipal"], 3_000);
    fila = ledger.leerLedger()[0];
    expect(fila.estado).toBe("ausencia_no_confirmada");
    expect(fila.missing_runs).toBe(2);

    ledger.registrarImportacion([], ["municipal"], 4_000);
    fila = ledger.leerLedger()[0];
    expect(fila.estado).toBe("ausencia_confirmada");
    expect(fila.missing_runs).toBe(3);
    expect(fila.fallos).toBe(3);

    ledger.registrarImportacion([ev("municipal", "Uno")], ["municipal"], 5_000);
    fila = ledger.leerLedger()[0];
    expect(fila.estado).toBe("activo");
    expect(fila.missing_runs).toBe(0);
    expect(fila.fallos).toBe(0);
  });

  it("cambio de enlace/slug con misma identidad actualiza la fila sin duplicar y crea alias determinista", () => {
    ledger.registrarImportacion(
      [{ source: "municipal", title: "Uno", date: FECHA, slug: "uno-viejo", link: "https://example.com/viejo" }],
      ["municipal"],
      1_000
    );

    ledger.registrarImportacion(
      [{ source: "municipal", title: "Uno", date: FECHA, slug: "uno-nuevo", link: "https://example.com/nuevo" }],
      ["municipal"],
      2_000
    );

    const filas = ledger.leerLedger();
    expect(filas).toHaveLength(1);
    expect(filas[0].tracking_id).toBe(ledger.trackingId("municipal", FECHA, "Uno"));
    expect(filas[0].slug).toBe("uno-nuevo");
    expect(filas[0].link).toBe("https://example.com/nuevo");
    expect(filas[0].estado).toBe("activo");

    expect(ledger.resolverAliasSlug("uno-viejo")).toEqual({
      canonical: "uno-nuevo",
      tracking_id: ledger.trackingId("municipal", FECHA, "Uno"),
      source: "municipal",
    });
  });

  it("mismo source+external_id con identidad/slug distinto crea alias al canónico actual (sin colisión)", () => {
    ledger.registrarImportacion(
      [{
        source: "municipal",
        title: "Uno",
        date: FECHA,
        slug: "slug-v1",
        link: "https://example.com/1",
        externalId: "ext-1",
      }],
      ["municipal"],
      1_000
    );

    // Cambia título => cambia tracking_id y slug, pero external_id estable es el mismo.
    ledger.registrarImportacion(
      [{
        source: "municipal",
        title: "Uno renombrado",
        date: FECHA,
        slug: "slug-v2",
        link: "https://example.com/1",
        externalId: "ext-1",
      }],
      ["municipal"],
      2_000
    );

    const resuelto = ledger.resolverAliasSlug("slug-v1");
    expect(resuelto).toEqual({
      canonical: "slug-v2",
      tracking_id: ledger.trackingId("municipal", FECHA, "Uno"),
      source: "municipal",
    });
  });

  it("sin fuentes sanas no se cuenta ninguna ausencia", () => {
    ledger.registrarImportacion(
      [ev("municipal", "Uno"), ev("euskadi", "Dos")],
      ["municipal", "euskadi"],
      1_000
    );

    const r = ledger.registrarImportacion([], [], 2_000);
    expect(r.ausentes).toBe(0);
    expect(ledger.leerLedger().every((f) => f.fallos === 0)).toBe(true);
  });

  it("una fuente que ya no está en el registro no acumula fallos", () => {
    // Un scraper retirado no debe convertirse en una alarma perpetua: como no
    // aparece en `fuentesSanas`, sus filas se quedan quietas.
    ledger.registrarImportacion([ev("retirada", "Uno")], ["retirada"], 1_000);
    ledger.registrarImportacion([], ["municipal"], 2_000);
    expect(ledger.leerLedger()[0].fallos).toBe(0);
  });

  it("guarda trazabilidad por fuente y ejecucion", () => {
    const r = ledger.registrarImportacion(
      [ev("municipal", "Uno"), ev("municipal", "Dos"), ev("euskadi", "Tres")],
      ["municipal", "euskadi"],
      1_000,
      3,
      [{ id: "rula", error: "MEC_TOKEN no esta definido" }]
    );

    expect(r.importacion).toBe(1);
    const detalle = ledger.leerFuentesDeImportacion(1);
    expect(detalle).toHaveLength(3);
    expect(detalle).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "rula", ok: 0, eventos_vistos: 0, error: "MEC_TOKEN no esta definido" }),
        expect.objectContaining({ source: "euskadi", ok: 1, eventos_vistos: 1, error: null }),
        expect.objectContaining({ source: "municipal", ok: 1, eventos_vistos: 2, error: null }),
      ])
    );
  });
});

describe("desanotarEvento", () => {
  it("quita exactamente la fila pedida y deja las vecinas", () => {
    ledger.registrarImportacion(
      [ev("municipal", "Uno"), ev("municipal", "Dos"), ev("euskadi", "Tres")],
      ["municipal", "euskadi"],
      1_000
    );

    const id = ledger.trackingId("municipal", FECHA, "Dos");
    expect(ledger.desanotarEvento(id)).toBe(1);
    expect(ledger.leerLedger()).toHaveLength(2);
    expect(ledger.leerLedger().map((f) => f.title)).not.toContain("Dos");
  });

  it("devuelve 0 cuando esa fila no está, y eso no es un fallo", () => {
    expect(ledger.desanotarEvento("municipal|2026-11-19|nunca")).toBe(0);
  });
});

describe("persistencia", () => {
  it("sobrevive a recargar los módulos", async () => {
    ledger.registrarImportacion([ev("municipal", "Uno")], ["municipal"], 1_000);

    reutilizarDbDePrueba();
    jest.resetModules();
    const otro = await import("@/lib/event-ledger");
    expect(otro.leerLedger()).toHaveLength(1);
  });
});

describe("registrarImportacionSegura", () => {
  it("si la base no se puede abrir, no lanza y avisa", async () => {
    // El registro no puede tumbar la agenda: si el volumen no está montado, el
    // peor resultado aceptable es que la vigilancia no funcione, no que la web
    // deje de servir.
    const dir = dbDePrueba();
    const fichero = join(dir, "soy-un-fichero");
    writeFileSync(fichero, "");
    process.env.EVENT_LEDGER_DB_DIR = fichero;

    jest.resetModules();
    const roto = await import("@/lib/event-ledger");
    const logRoto = (await import("@/lib/axiom/server")).logger as unknown as Logger;

    expect(() => roto.registrarImportacion([ev("municipal", "Uno")], ["municipal"], 1_000)).toThrow();
    expect(roto.registrarImportacionSegura([ev("municipal", "Uno")], ["municipal"], 1_000)).toBeNull();
    expect(logRoto.warn).toHaveBeenCalled();
  });

  it("en el camino feliz devuelve el mismo resultado que la versión cruda", () => {
    const r = ledger.registrarImportacionSegura([ev("municipal", "Uno")], ["municipal"], 1_000);
    expect(r).toEqual({
      importacion: 1,
      vistos: 1,
      ausentes: 0,
      nuevos: 1,
      fuentesSanas: 1,
      fuentesFallidas: 0,
    });
  });
});
