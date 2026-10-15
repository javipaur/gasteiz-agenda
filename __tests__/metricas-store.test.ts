import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { dbDePrueba, limpiarDbsDePrueba } from "./helpers-metricas";

/**
 * El store de métricas contra una base de verdad.
 *
 * Lo que se prueba aquí es lo que un recuento no puede comprobar: que dos
 * `anotar` del mismo evento **suman** y no se pisan, que un `GROUP BY` sobre una
 * tabla con filas de varios eventos devuelve una fila por evento y no una sola,
 * y que `podar` borra por reloj y no por número de fila.
 */

type Store = typeof import("@/lib/metricas-store");

let store: Store;

async function cargar(): Promise<Store> {
  dbDePrueba();
  jest.resetModules();
  store = await import("@/lib/metricas-store");
  return store;
}

afterAll(() => {
  limpiarDbsDePrueba();
});

beforeEach(async () => {
  await cargar();
});

describe("anotar y resumen", () => {
  it("una base nueva cuenta cero en los cinco eventos", () => {
    const r = store.resumen();
    expect(r.total).toBe(0);
    expect(r.primera).toBeNull();
    expect(r.ultima).toBeNull();
    expect(r.porEvento.visita).toBe(0);
    expect(r.porEvento.instalada).toBe(0);
  });

  it("dos filas del mismo evento se suman", () => {
    store.anotar("visita", 1_700_000_000_000);
    store.anotar("visita", 1_700_000_001_000);
    const r = store.resumen();
    expect(r.porEvento.visita).toBe(2);
    expect(r.total).toBe(2);
  });

  it("cada evento va a su columna y no a la de al lado", () => {
    // El fallo que este caso vigila: un `GROUP BY` mal escrito que acumula todos
    // los nombres en la primera fila. El síntoma sería `visita: 6` con las otras
    // cuatro columnas a cero, y el número del panel no cuadraría con nada.
    store.anotar("visita", 1_700_000_000_000);
    store.anotar("visita", 1_700_000_001_000);
    store.anotar("instalada", 1_700_000_002_000);
    store.anotar("instalacion_aceptada", 1_700_000_003_000);
    store.anotar("instalacion_descartada", 1_700_000_004_000);
    store.anotar("instalacion_no_disponible", 1_700_000_005_000);

    const r = store.resumen();
    expect(r.porEvento).toEqual({
      visita: 2,
      instalada: 1,
      instalacion_aceptada: 1,
      instalacion_descartada: 1,
      instalacion_no_disponible: 1,
    });
    expect(r.total).toBe(6);
  });

  it("la primera y la última son el mínimo y el máximo reales", () => {
    // Las filas se escriben desordenadas a propósito: dos pestañas pueden tener
    // relojes que difieren, y si el `MIN`/`MAX` se calculara sobre el orden de
    // inserción en vez de sobre el valor, estos dos números saldrían al revés.
    store.anotar("visita", 1_700_000_009_000);
    store.anotar("visita", 1_700_000_002_000);
    store.anotar("visita", 1_700_000_005_000);
    const r = store.resumen();
    expect(r.primera).toBe(1_700_000_002_000);
    expect(r.ultima).toBe(1_700_000_009_000);
  });

  it("sobrevive a recargar los módulos", () => {
    // La conexión vive en una variable de módulo a propósito, para no abrir un
    // fichero SQLite por petición. El coste es que el estado tiene que estar en el
    // fichero y no en la memoria del módulo: si estuviera en la memoria, esto no
    // contaría y el contador se reiniciaría en cada redeploy.
    store.anotar("instalada", 1_700_000_000_000);
    jest.resetModules();
    return import("@/lib/metricas-store").then((otro) => {
      expect(otro.resumen().porEvento.instalada).toBe(1);
    });
  });
});

describe("podar", () => {
  it("borra lo anterior al reloj dado y devuelve cuántas se fueron", () => {
    store.anotar("visita", 1_000);
    store.anotar("visita", 2_000);
    store.anotar("visita", 3_000);

    expect(store.podar(2_000)).toBe(1);
    expect(store.resumen().porEvento.visita).toBe(2);
    expect(store.resumen().primera).toBe(2_000);
  });

  it("no borra nada si el reloj está antes de todo", () => {
    store.anotar("visita", 5_000);
    expect(store.podar(1)).toBe(0);
    expect(store.resumen().porEvento.visita).toBe(1);
  });

  it("una poda de hace un año no toca las filas de hoy", () => {
    // El otro lado del contrato de `ahoraDelCliente`: con un reloj sensato
    // ninguna fila queda fuera del alcance de una poda de un año, que es la que
    // ejecutaría el comando de limpieza.
    const ahora = Date.now();
    store.anotar("visita", ahora);
    expect(store.podar(ahora - 365 * 24 * 60 * 60 * 1000)).toBe(0);
    expect(store.resumen().porEvento.visita).toBe(1);
  });
});

describe("una fila con un nombre que ya no existe en la lista", () => {
  it("no aparece en el resumen", () => {
    // Se escribe saltándose el filtro a propósito, que es lo que haría una versión
    // anterior de `EVENTOS` que hubiera perdido un nombre tras haberlo usado: la
    // tabla tiene la fila y el resumen **no** la cuenta.
    //
    // Contarla sería peor que perderla: aparecería con una clave que el tipo no
    // declara y que `resumenVacio()` no tiene, así que el panel enseñaría un
    // número que nada puede explicar. Perderla es visible si alguien mira la
    // tabla, que es donde se mira cuando el panel no cuadra.
    //
    // La anotación buena va primero porque la base y su esquema se crean la
    // primera vez que alguien escribe: abrirla antes daría "no such table".
    store.anotar("visita", 1_700_000_000_000);

    const ruta = join(process.env.METRICAS_DB_DIR!, "metricas.db");
    const conexion = new DatabaseSync(ruta);
    conexion
      .prepare("INSERT INTO eventos (nombre, ts) VALUES (?, ?)")
      .run("evento_retirado", 1_700_000_000_500);
    conexion.close();

    const r = store.resumen();
    expect(Object.keys(r.porEvento)).not.toContain("evento_retirado");
    expect(r.porEvento.visita).toBe(1);
    expect(r.total).toBe(1);
    expect(r.primera).toBe(1_700_000_000_000);
  });
});