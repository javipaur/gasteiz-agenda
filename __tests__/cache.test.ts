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