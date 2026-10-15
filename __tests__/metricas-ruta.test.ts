import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";

import { dbDePrueba, limpiarDbsDePrueba } from "./helpers-metricas";

/**
 * El desglose por ruta, que es lo que convierte el contador en un embudo.
 *
 * Lo que importa aquí no es el `GROUP BY` —eso es `sqlite3`— sino las dos filas
 * que **no** tienen ruta y la ruta que se acota: un `INSERT` con la columna a
 * `NULL` no puede reventar el `GROUP BY`, y una ruta enorme no puede llenar la
 * tabla.
 */

type Store = typeof import("@/lib/metricas-store");

let store: Store;

async function cargar(): Promise<Store> {
  dbDePrueba();
  jest.resetModules();
  store = await import("@/lib/metricas-store");
  return store;
}

beforeEach(async () => {
  await cargar();
});

afterAll(() => {
  limpiarDbsDePrueba();
});

describe("porRuta", () => {
  it("una base vacía devuelve mapas vacíos y cero sin ruta", () => {
    const r = store.porRuta();
    expect(r.visitasPorRuta).toEqual({});
    expect(r.instalacionPorRuta).toEqual({});
    expect(r.sinRuta).toBe(0);
  });

  it("cuenta las visitas agrupadas por ruta", () => {
    store.anotar("visita", 1_000, "/");
    store.anotar("visita", 2_000, "/");
    store.anotar("visita", 3_000, "/instalar");
    store.anotar("visita", 4_000, "/culture");

    expect(store.porRuta().visitasPorRuta).toEqual({
      "/": 2,
      "/instalar": 1,
      "/culture": 1,
    });
  });

  it("separa las instalaciones del resto de eventos por ruta", () => {
    // El embudo que responde "¿instalan desde la home o desde /instalar?" necesita
    // que `instalada` tenga su propio mapa. Si compartieran, el número de
    // instalaciones de una ruta quedaría mezclado con visitas y la tasa de
    // conversión saldría inflada.
    store.anotar("visita", 1_000, "/");
    store.anotar("visita", 2_000, "/instalar");
    store.anotar("instalada", 3_000, "/instalar");

    const r = store.porRuta();
    expect(r.visitasPorRuta).toEqual({ "/": 1, "/instalar": 1 });
    expect(r.instalacionPorRuta).toEqual({ "/instalar": 1 });
  });

  it("cuenta aparte las filas sin ruta en vez de repartirlas", () => {
    /*
     * Este es el caso que importa. Una fila antigua —escrita antes de la
     * migración 3— tiene la columna a `NULL`, y una visita sin `ruta` llega cuando
     * el `sessionStorage` no está disponible.
     *
     * Repartirlas por la ruta principal haría que `/` pareciera más visitada de lo
     * que es, y ese es exactamente el número que se usa para decidir dónde va el
     * botón de instalar. Contarlas y decirlas en voz alta es lo que no miente.
     */
    store.anotar("visita", 1_000, "/");
    store.anotar("visita", 2_000);

    const r = store.porRuta();
    expect(r.visitasPorRuta).toEqual({ "/": 1 });
    expect(r.sinRuta).toBe(1);
  });

  it("sobrevive a recargar los módulos", () => {
    // La columna nueva está en el fichero, no en la memoria del módulo. Si estuviera
    // en la memoria, este `INSERT` sin nombre de columna fallaría.
    store.anotar("visita", 1_000, "/");
    jest.resetModules();
    return import("@/lib/metricas-store").then((otro) => {
      expect(otro.porRuta().visitasPorRuta).toEqual({ "/": 1 });
    });
  });

  it("una fila con la ruta a NULL no rompe el agrupado", () => {
    // Se escribe a mano saltándose el store para tener una fila con la columna a
    // `NULL` sin tener que depender de que `sessionStorage` falle en un navegador
    // de verdad. La anotación buena va antes porque la base y su esquema se crean
    // la primera vez que alguien escribe.
    store.anotar("visita", 1_000, "/");

    const ruta = join(process.env.METRICAS_DB_DIR!, "metricas.db");
    const conexion = new DatabaseSync(ruta);
    conexion
      .prepare("INSERT INTO eventos (nombre, ts, ruta) VALUES (?, ?, NULL)")
      .run("visita", 9_000);
    conexion.close();

    // La fila sin ruta **no** se cuela en `/`: es lo que este caso vigila, porque
    // `GROUP BY ruta` sobre un `NULL` produce su propio grupo y una lectura
    // ingenua lo sumaría al primero.
    expect(store.porRuta().visitasPorRuta).toEqual({ "/": 1 });
    expect(store.porRuta().sinRuta).toBe(1);
  });

  it("los eventos del embudo que no mandan ruta tampoco se reparten", () => {
    // `instalacion_aceptada` no lleva ruta a propósito: puede venir del banner de
    // la home o de la página de instalación y no hay forma de saberlo sin
    // identificar a la persona entre páginas. Contarlo en el mapa de instalaciones
    // por ruta sería inventarle un sitio.
    store.anotar("instalacion_aceptada", 1_000);
    store.anotar("instalacion_aceptada", 2_000);

    const r = store.porRuta();
    expect(r.instalacionPorRuta).toEqual({});
    expect(r.sinRuta).toBe(2);
    // Y el total sigue contando las cinco categorías: el resumen no se pierde nada.
    expect(store.resumen().porEvento.instalacion_aceptada).toBe(2);
  });
});