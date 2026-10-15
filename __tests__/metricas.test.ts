import { dbDePrueba, limpiarDbsDePrueba } from "./helpers-metricas";
import { join } from "node:path";

/**
 * La hoja pura de los eventos: la lista cerrada y su filtro.
 *
 * Se prueba en node y sin tocar la base a propósito, porque el filtro de la ruta
 * depende de esto y una lista de `string` libre sería un contador que cualquiera
 * puede inflar desde el `POST` público.
 */

import { EVENTOS, esEvento, resumenVacio } from "@/lib/metricas";

afterAll(() => {
  limpiarDbsDePrueba();
});

describe("esEvento", () => {
  it("acepta los cinco eventos y nada más", () => {
    for (const nombre of EVENTOS) {
      expect(esEvento(nombre)).toBe(true);
    }
  });

  it("rechaza lo que no está en la lista", () => {
    for (const nombre of ["otro", "", "VISITA", "visita ", "instalada\n"]) {
      expect(esEvento(nombre)).toBe(false);
    }
  });

  it("rechaza lo que no es un string", () => {
    // El `POST` es público, así que el nombre puede venir como número, `null`, o
    // un objeto con `toString` hostil. Nada de eso pasa el filtro.
    for (const nombre of [null, undefined, 1, true, {}, ["visita"]]) {
      expect(esEvento(nombre)).toBe(false);
    }
  });

  it("la lista no se puede desincronizar del Set", () => {
    /**
     * El `Set` de `lib/metricas.ts` se deriva del array a propósito. Si alguien
     * escribiera un `Set` aparte y olvidara añadir un evento, el `Set` lo
     * rechazaría en silencio y ese evento nunca se podría contar. Este caso falla
     * al añadir uno al array, que es el momento en que se nota.
     */
    const largos = [...EVENTOS].sort();
    expect(largos).toHaveLength(5);
    expect(largos).toEqual([
      "instalacion_aceptada",
      "instalacion_descartada",
      "instalacion_no_disponible",
      "instalada",
      "visita",
    ]);
  });
});

describe("resumenVacio", () => {
  it("tiene las cinco claves a cero y las fechas vacías", () => {
    const r = resumenVacio();
    expect(Object.keys(r.porEvento).sort()).toEqual([...EVENTOS].sort());
    expect(r.total).toBe(0);
    expect(r.primera).toBeNull();
    expect(r.ultima).toBeNull();
  });

  it("no comparte el objeto entre llamadas", () => {
    /**
     * Si las dos llamadas compartieran el mismo `porEvento`, anotar en la base de
     * un test contaminaría la del siguiente, y el fallo aparecería en un sitio
     * distinto del que lo causando. Es el mismo motivo por el que
     * `dbDePrueba()` no comparte directorio.
     */
    const a = resumenVacio();
    a.porEvento.visita = 7;
    expect(resumenVacio().porEvento.visita).toBe(0);
  });
});

describe("la base de prueba", () => {
  it("apunta a un directorio nuevo y no al .data del repo", () => {
    // La comprobación de que el helper aísla de verdad: si `METRICAS_DB_DIR` no
    // estuviera puesto, el store escribiría en `.data/metricas.db` del repo y el
    // contador de la máquina de quien ejecuta los tests acabaría en el `git status`.
    const dir = dbDePrueba();
    expect(process.env.METRICAS_DB_DIR).toBe(dir);
    expect(dir).not.toContain(join("gasteiz-agenda", ".data"));
  });
});