import crypto from "crypto";
import { getCachedOrFetch } from "@/lib/cache";

function uniqueKey(): string {
  return `test-${crypto.randomUUID()}`;
}

/**
 * Por qué los dos tests de TTL fijan el reloj en vez de confiar en `Date.now()`.
 *
 * `getCachedOrFetch` decide con `age = Date.now() - stat.mtimeMs < ttlMs`, y esas
 * dos medidas no salen del mismo reloj: el `mtimeMs` lo pone el sistema de
 * ficheros. Medido en esta máquina, el `mtime` de un fichero recién escrito va
 * **entre 2 y 3 ms por delante** del `Date.now()` que se mide justo después, así que
 * `age` sale negativo de forma normal y no por casualidad.
 *
 * Con eso, un TTL negativo —que es lo que usaba este test— convierte la rama
 * "expirado" en una comparación que solo puede ser falsa si el desfase cambia de
 * signo: `age < -1` es falso con `age` negativo, o sea que el caché se ve fresco
 * con un TTL de -1 ms. Medido por un implementador anterior: 6 de 25 ejecuciones
 * fallaban sin ningún cambio en el repo. Y cambiarlo a `ttlMs = 0` tampoco vale,
 * porque en esta máquina `age < 0` es cierto casi siempre: medido, 20 de 30
 * ejecuciones fallan.
 *
 * Fijar el reloj quita la aritmética del medio en vez de taparla. El margen son
 * diez minutos frente a un TTL de un minuto, de modo que un desfase de milisegundos
 * —o de segundos— no lo cruza, y los dos tests quedan como un intervalo del mismo
 * reloj: la misma entrada, antes y después de caducar.
 */
describe("getCachedOrFetch", () => {
  it("calls the fetcher on cache miss", async () => {
    const fetcher = jest.fn().mockResolvedValue({ items: [1, 2, 3] });

    const result = await getCachedOrFetch(uniqueKey(), 60_000, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ items: [1, 2, 3] });
  });

  it("serves from cache on a second call before TTL", async () => {
    const key = uniqueKey();
    const fetcher = jest.fn().mockResolvedValue({ value: "first" });
    const now = Date.now();
    jest.spyOn(Date, "now").mockReturnValue(now);

    const first = await getCachedOrFetch(key, 60_000, fetcher);
    const second = await getCachedOrFetch(key, 60_000, fetcher);

    expect(first).toEqual({ value: "first" });
    expect(second).toEqual({ value: "first" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("refetches after the TTL expires", async () => {
    const key = uniqueKey();
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce({ value: "stale" })
      .mockResolvedValueOnce({ value: "fresh" });
    const now = Date.now();

    // Se escribe con el reloj de verdad, para que el `mtime` del fichero sea real.
    const first = await getCachedOrFetch(key, 60_000, fetcher);

    // Y luego el reloj salta diez minutos: la entrada tiene diez minutos y el TTL
    // es de uno, así que está caducada por un margen que ningún desfase cruza.
    jest.spyOn(Date, "now").mockReturnValue(now + 10 * 60 * 1000);
    const second = await getCachedOrFetch(key, 60_000, fetcher);

    expect(first).toEqual({ value: "stale" });
    expect(second).toEqual({ value: "fresh" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("propagates fetcher errors", async () => {
    const fetcher = jest.fn().mockRejectedValue(new Error("boom"));

    await expect(getCachedOrFetch(uniqueKey(), 60_000, fetcher)).rejects.toThrow("boom");
  });

  it("handles complex cache keys", async () => {
    const fetcher = jest.fn().mockResolvedValue([1]);

    const result = await getCachedOrFetch(
      "eventos-proximos?with=special-chars/ñ&ú_x001f\u0000",
      60_000,
      fetcher
    );
    expect(result).toEqual([1]);
  });
});

/**
 * `single-flight`: dos llamadas concurrentes a la misma clave ejecutan el
 * `fetcher` una vez y las dos reciben el mismo valor.
 *
 * Sin esto, con la caché fría y tráfico normal, el coste se multiplica por el
 * número de peticiones simultáneas. Para una fuente de 6,5 MB son descargas
 * repetidas y en paralelo al servidor de la otra punta, no una.
 */
describe("single-flight", () => {
  it("dos llamadas concurrentes a la misma clave ejecutan el fetcher una vez", async () => {
    const key = uniqueKey();
    // El fetcher no resuelve hasta que el test suelta la puerta, así que
    // mientras dura la llamada no existe ningún fichero en la caché para esta
    // clave: cualquier lectura que occurra en ese margen tiene que fallar y
    // acabar en el `fetcher`.
    let abrir: (valor: { value: string }) => void = () => {};
    const puerta = new Promise<{ value: string }>((resolve) => {
      abrir = resolve;
    });
    let ejecuciones = 0;
    const fetcher = jest.fn(async () => {
      ejecuciones += 1;
      return puerta;
    });

    const a = getCachedOrFetch(key, 60_000, fetcher);
    const b = getCachedOrFetch(key, 60_000, fetcher);

    // Por qué el bucle y no dos `await` seguidos: sin `single-flight`, la segunda
    // llamada recorre su propio `fs.stat`, que es asíncrono, antes de llegar al
    // `fetcher`. Con dos `await` seguidos, ese `stat` puede resolverse después de
    // que la primera escriba, la segunda lee de la caché y el test pasa **sin**
    // `single-flight`: verde falso. Aquí se mide antes de que la primera pueda
    // escribir, con lo que el fichero todavía no puede salvar a nadie.
    const limite = Date.now() + 500;
    while (ejecuciones < 2 && Date.now() < limite) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    expect(ejecuciones).toBe(1);

    abrir({ value: "primera" });
    await expect(a).resolves.toEqual({ value: "primera" });
    await expect(b).resolves.toEqual({ value: "primera" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("el single-flight es por clave, no global", async () => {
    // Una promesa en vuelo compartida por todas las claves devolvería el dato de
    // una fuente en la de otra, que es un fallo silencioso: no da error, enseña
    // la cartelera de un sitio en la de otro.
    const primera = getCachedOrFetch(uniqueKey(), 60_000, jest.fn().mockResolvedValue([1]));
    const segunda = getCachedOrFetch(uniqueKey(), 60_000, jest.fn().mockResolvedValue([2]));

    await expect(primera).resolves.toEqual([1]);
    await expect(segunda).resolves.toEqual([2]);
  });

  it("tras un fallo una llamada nueva vuelve a intentarlo", async () => {
    // La entrada en vuelo tiene que desaparecer aunque el `fetcher` reviente. Si
    // se queda, toda llamada posterior recibe la promesa rechazada de un intento
    // que ya terminó: no vuelve a Scrapear nunca y el fallo puntual de una fuente
    // se convierte en un fallo permanente. Aquí el primer intento falla y el
    // segundo devuelve, lo que además ata que un fallo no se cachea.
    const key = uniqueKey();
    const fetcher = jest
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ value: "recuperado" });

    await expect(getCachedOrFetch(key, 60_000, fetcher)).rejects.toThrow("boom");
    await expect(getCachedOrFetch(key, 60_000, fetcher)).resolves.toEqual({
      value: "recuperado",
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("una llamada que hereda un fallo también propaga el error", async () => {
    // La que espera a la primera en vuelo recibe la misma promesa rechazada, así
    // que el fallo se propaga en vez de quedar colgada. Sin el borrado en
    // `finally` este test pasa también; lo que lo ata es el de arriba.
    const key = uniqueKey();
    const fetcher = jest.fn().mockRejectedValue(new Error("boom"));

    const a = getCachedOrFetch(key, 60_000, fetcher);
    const b = getCachedOrFetch(key, 60_000, fetcher);

    await expect(a).rejects.toThrow("boom");
    await expect(b).rejects.toThrow("boom");
  });
});