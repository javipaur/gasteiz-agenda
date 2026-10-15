import { dbDePrueba, limpiarDbsDePrueba } from "./helpers-metricas";

/**
 * La poda que llama el scheduler.
 *
 * Lo que hay que comprobar aquí no es que `DELETE` funciona —eso lo prueba el otro
 * fichero— sino el motivo por el que existe esta función en vez de llamar a
 * `podar()` directamente: el scheduler corre un tick cada diez minutos, y sin el
 * marcador de día la poda se ejecutaría 144 veces al día para borrar cero filas
 * 143 de ellas.
 */

type Store = typeof import("@/lib/metricas-store");

let store: Store;

const DIA = 24 * 60 * 60 * 1000;

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

describe("podarSiToca", () => {
  it("la primera llamada del día poda y devuelve cuántas se fueron", () => {
    const ahora = Date.UTC(2026, 2, 15, 12, 0, 0);
    store.anotar("visita", ahora - 500 * DIA);
    store.anotar("visita", ahora - 10 * DIA);

    expect(store.podarSiToca(400, ahora)).toBe(1);
    expect(store.resumen().porEvento.visita).toBe(1);
  });

  it("la segunda llamada del mismo día no hace nada y devuelve `null`", () => {
    const manana = Date.UTC(2026, 2, 15, 12, 0, 0);
    store.anotar("visita", manana - 500 * DIA);

    expect(store.podarSiToca(400, manana)).toBe(1);
    // Diez minutos después, como el scheduler. El `null` es la respuesta normal.
    expect(store.podarSiToca(400, manana + 10 * 60 * 1000)).toBeNull();
    expect(store.podarSiToca(400, manana + 5 * 60 * 60 * 1000)).toBeNull();
  });

  it("al día siguiente vuelve a podar aunque no haya nada que borrar", () => {
    // El `0` y no `null`: la poda **se hizo**, yeso es lo que el caso comprueba. Un
    // `null` aquí sería el bug contrario: el marcador se advancing sin ejecutar el
    // `DELETE` y la tabla nunca se recorta.
    const hoy = Date.UTC(2026, 2, 15, 12, 0, 0);
    expect(store.podarSiToca(400, hoy)).toBe(0);
    expect(store.podarSiToca(400, hoy + DIA)).toBe(0);
  });

  it("el marcador sobrevive a recargar los módulos", () => {
    // La conexión es un singleton de módulo, así que el `meta` vive en el fichero.
    // Si estuviera en memoria, este `null` sería un `0` y el scheduler podaría en
    // cada tick sin que nada lo delatara.
    const ahora = Date.UTC(2026, 2, 15, 12, 0, 0);
    expect(store.podarSiToca(400, ahora)).toBe(0);

    jest.resetModules();
    return import("@/lib/metricas-store").then((otro) => {
      expect(otro.podarSiToca(400, ahora + 3600 * 1000)).toBeNull();
    });
  });

  it("a caballo de la medianoche de Madrid, son dos días aunque en UTC sean uno", () => {
    // Este caso es el que justifica `diaEnZona` y no un `toISOString().slice(0,10)`.
    //
    // En marzo de 2026 Madrid es UTC+1, así que la medianoche local del día 16 cae
    // a las 23:00 UTC del día 15. Los dos instantes de abajo están **separados por un
    // segundo y comparten día en UTC**, pero son días distintos en Madrid: el
    // primero es todavía el 15 y el segundo ya es el 16.
    //
    // Una implementación en UTC no podaría la segunda vez, y la poda se retrasaría
    // un día entero cada vez que el tick caiga cerca de la medianoche. Con la zona
    // explícita, la segunda llamada poda, que es lo correcto.
    const todaviaDia15 = Date.UTC(2026, 2, 15, 22, 59, 59);
    const yaDia16 = Date.UTC(2026, 2, 15, 23, 0, 1);

    store.anotar("visita", todaviaDia15 - 500 * DIA);
    expect(store.podarSiToca(400, todaviaDia15)).toBe(1);

    store.anotar("visita", yaDia16 - 500 * DIA);
    expect(store.podarSiToca(400, yaDia16)).toBe(1);

    // Y dentro del mismo día local, ya no poda.
    expect(store.podarSiToca(400, yaDia16 + 3600 * 1000)).toBeNull();
  });

  it("la ventana se mide en días, no en número de filas", () => {
    const ahora = Date.UTC(2026, 2, 15, 12, 0, 0);
    store.anotar("visita", ahora - 401 * DIA);
    store.anotar("visita", ahora - 399 * DIA);
    store.anotar("instalada", ahora - 399 * DIA);

    expect(store.podarSiToca(400, ahora)).toBe(1);
    const r = store.resumen();
    expect(r.porEvento.visita).toBe(1);
    expect(r.porEvento.instalada).toBe(1);
  });
});