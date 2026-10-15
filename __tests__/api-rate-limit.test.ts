import { consume, ipDe, reiniciaLimite } from "@/lib/api-rate-limit";

/**
 * El límite de las rutas públicas de `/api`.
 *
 * El caso que este fichero vigila de verdad no es "se rechazan a partir de N", es
 * el del final: **sin IP no se rechaza**. Es una decisión que parece un agujero y
 * no lo es, y por eso necesita un test que la fije; si alguien la "arregla"
 * rechazando cuando no se sabe de quién es la petición, un sitio detrás de un
 * proxy que no manda cabeceras se queda sin contador y sin un solo error.
 */

function pedir(ip: string | null, veces = 1) {
  const resultados = [];
  for (let i = 0; i < veces; i++) resultados.push(consume(ip));
  return resultados;
}

beforeEach(() => {
  reiniciaLimite();
});

describe("ipDe", () => {
  it("lee x-forwarded-for y se queda con la primera", () => {
    // Con una cadena de proxies, la primera es el cliente. La última sería el
    // proxy de al lado, y limiting por proxy bloquearía a todo el mundo detrás de
    // un CDN de golpe.
    expect(ipDe(new Request("http://x/", { headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" } }))).toBe(
      "1.2.3.4"
    );
  });

  it("cae a x-real-ip y luego a Forwarded", () => {
    expect(ipDe(new Request("http://x/", { headers: { "x-real-ip": "5.6.7.8" } }))).toBe("5.6.7.8");
    expect(
      ipDe(new Request("http://x/", { headers: { forwarded: 'for=9.9.9.9;proto=https' } }))
    ).toBe("9.9.9.9");
  });

  it("devuelve null si no hay ninguna", () => {
    expect(ipDe(new Request("http://x/"))).toBeNull();
  });
});

describe("consume", () => {
  it("deja pasar por debajo del tope", () => {
    const r = pedir("1.1.1.1", 50);
    expect(r.every((x) => x.ok)).toBe(true);
  });

  it("rechaza al pasar el tope, y dice cuánto falta", () => {
    pedir("1.1.1.1", 60);
    const sexto = consume("1.1.1.1");
    expect(sexto.ok).toBe(false);
    if (!sexto.ok) {
      // El `Retry-After` sin el que un cliente no sabe cuándo reintentar y se
      // rinde o entra en bucle.
      expect(sexto.reintentarEn).toBeGreaterThan(0);
      expect(sexto.reintentarEn).toBeLessThanOrEqual(60);
    }
  });

  it("las cuentas son por IP y no globales", () => {
    // El modo de fallo sería un `Map` compartido: una persona que carga la home
    // treinta veces desde su móvil dejaría sin métricas a todo el mundo detrás del
    // mismo NAT durante un minuto.
    pedir("1.1.1.1", 60);
    expect(consume("1.1.1.1").ok).toBe(false);
    expect(consume("2.2.2.2").ok).toBe(true);
  });

  it("la ventana se reabre pasado el minuto", () => {
    jest.useFakeTimers();
    try {
      pedir("1.1.1.1", 60);
      expect(consume("1.1.1.1").ok).toBe(false);

      jest.advanceTimersByTime(61_000);

      expect(consume("1.1.1.1").ok).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it("sin IP se acepta siempre", () => {
    /*
     * La decisión. Sin IP known no hay contra quién contar, y las dos salidas son
     * malas: rechazar deja el sitio entero sin métricas sin un solo error, y dejar
     * pasar deja un hueco. Se elige el hueco porque un hueco se ve —el contador no
     * cuadra— y un rechazo silencioso no.
     */
    const r = pedir(null, 500);
    expect(r.every((x) => x.ok)).toBe(true);
  });

  it("la limpieza de cuentas viejas no crece sin límite", () => {
    // 200 IPs distintas repartidas en el tiempo dejan 200 entradas si no se barren,
    // y el `Map` vive para siempre porque es de módulo.
    jest.useFakeTimers();
    try {
      for (let i = 0; i < 200; i++) {
        consume(`10.0.${Math.floor(i / 256)}.${i % 256}`);
        jest.advanceTimersByTime(100);
      }
      // Cinco minutos después de la última, el barrido tiene que haber actuado.
      jest.advanceTimersByTime(5 * 60_000 + 1_000);
      consume("192.0.2.1");

      // Si la limpieza funciona, las 200 antiguas están fuera y solo queda la
      // nueva. Se mide por el tamaño que devuelve `reiniciaLimite`.
      const vivos = reiniciaLimite();
      expect(vivos).toBeLessThanOrEqual(2);
    } finally {
      jest.useRealTimers();
    }
  });
});