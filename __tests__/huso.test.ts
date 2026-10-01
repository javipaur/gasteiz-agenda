import { localDateKey } from "@/lib/slug";

/**
 * La zona horaria del runner de tests no es un detalle: es lo que decide si
 * media docena de tests del repo tienen capacidad de detectar una regresión.
 *
 * `process.env.TZ` está en `jest.config.ts` y no en un `beforeAll` porque este
 * fichero se evalúa antes de bifurcar los workers y la variable llega heredada.
 * Ponerla dentro de un test no hace nada: V8 fija la zona por isolate al arrancar
 * el worker.
 *
 * El riesgo no es que los tests fallen, es que **no puedan fallar**. En UTC
 * `localDateKey(d)` y `d.slice(0,10)` son la misma función para toda fecha, así
 * que un test que compare ambas no distingue la implementación buena de un
 * `date.slice(0, 10)` colado donde toque. El caso de la clave de dedupe de
 * `__tests__/agenda.test.ts` avisaba por consola cuando no podía proteger, lo
 * cual es correcto pero débil: un aviso se pasa por alto y el test sigue verde.
 * Este test lo convierte en un rojo.
 */
describe("el runner de tests no está en UTC", () => {
  it("la zona resuelta es Europe/Madrid", () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("Europe/Madrid");
  });

  it("existe una fecha en la que el día local y el prefijo ISO no coinciden", () => {
    // La capacidad de distinguir `localDateKey` de `d.slice(0, 10)` no depende de
    // la fecha concreta: basta con que exista una. Al este de UTC la medianoche
    // local es `...T23:00:00.000Z` del día anterior, así que la fecha del día local
    // no es la que lleva el prefijo ISO. En UTC no existe ninguna y por eso el
    // caso de abajo no podría existir.
    const discrepancias = [15, 16, 17].filter(
      (dia) => localDateKey(new Date(2027, 0, dia, 0, 0, 0).toISOString()) !==
        new Date(2027, 0, dia, 0, 0, 0).toISOString().slice(0, 10)
    );
    expect(discrepancias.length).toBeGreaterThan(0);
  });

  it("localDateKey devuelve el día local, no el del prefijo ISO", () => {
    // El caso concreto que motivó todo esto: `scrapeSenderismo` emite
    // `new Date(y, m, d).toISOString()`, y en Madrid eso es la medianoche local
    // pasada por UTC. Un evento que el usuario ve el 15 llega con
    // `T23:00:00.000Z` del 14, así que tomar `slice(0, 10)` lo fecharía en el día
    // anterior.
    const medianocheLocal = new Date(2027, 0, 15, 0, 0, 0).toISOString();
    expect(medianocheLocal).toMatch(/T2[23]:00:00\.000Z$/);
    expect(medianocheLocal.slice(0, 10)).toBe("2027-01-14");
    expect(localDateKey(medianocheLocal)).toBe("2027-01-15");
  });
});