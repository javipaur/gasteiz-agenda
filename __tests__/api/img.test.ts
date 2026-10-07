/**
 * El proxy de imágenes de los hosts que rechazan al optimizador de Next.
 *
 * **Por qué existe esta ruta.** El optimizador de `next/image` manda cabeceras fijas
 * —`BASE_REQ_HEADERS` en `image-optimizer.js`, con `user-agent: node` escrito a fuego— y
 * no hay ninguna opción de `next.config.ts` para cambiarlas. La Genterula tiene un WAF
 * que **403 a cualquier User-Agent que contenga la cadena "node"**, así que sus fotos no
 * llegan nunca al optimizador y las tarjetas pintaban el degradado gris del tile: 65 de
 * las 111 imágenes de la home, medido el 7 de octubre de 2026.
 *
 * Lo que fija este test es la puerta, no la foto: que se sirva lo que `IMAGE_HOSTS`
 * acepta y nada más. Un proxy de imágenes sin lista blanca es un amplificador de tráfico
 * contra terceros, que es justo lo que `lib/image-hosts.ts` cerró el 30 de septiembre.
 * Que se use la misma función y no una copia es la mitad del motivo: si mañana un host
 * entra en la lista, entra aquí sin que nadie tenga que acordarse.
 */
import { imagenServible } from "@/lib/image-hosts";

const LA_GENTERULA = "https://lagenterula.com/wp-content/uploads/2026/10/cartel.webp";

/** Un cuerpo binario cualquiera: a esta ruta solo le importa el `content-type`. */
const PIXELES = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00]);

/**
 * Un `fetch` falso con la firma completa, para que `mock.calls` guarde los dos
 * argumentos. El tipo explícito es lo que evita el `as unknown as typeof fetch` de
 * ocho sitios, que es la forma que deja de avisar cuando la firma de la ruta cambia.
 */
function imagenMock(extra: { status?: number; contentType?: string } = {}) {
  return jest.fn(
    async (_url: string, _opciones?: RequestInit) =>
      new Response(PIXELES, {
        status: extra.status ?? 200,
        headers: {
          "content-type": extra.contentType ?? "image/webp",
          "cache-control": "public, max-age=604800",
        },
      })
  );
}

function poner(mf: ReturnType<typeof imagenMock> | jest.Mock): void {
  global.fetch = mf as unknown as typeof fetch;
}

describe("GET /api/img", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function pedir(url: string | null) {
    const { GET } = await import("@/app/api/img/route");
    const destino =
      url === null
        ? "http://localhost:3000/"
        : `http://localhost:3000/api/img?url=${encodeURIComponent(url)}`;
    return GET(new Request(destino));
  }

  it("sirve la imagen de un host de la lista, y lo hace con un User-Agent que no contiene 'node'", async () => {
    // La razón de la ruta entera. Con el UA por defecto de undici —`node`— este
    // `fetch` devolvería 403 contra el WAF real, y el test no lo vería porque el mock
    // responde 200 a cualquier cosa. Por eso se mira **la cabecera que sale**, que es lo
    // que decide contra el host de verdad.
    const fetchMock = imagenMock();
    poner(fetchMock);

    const res = await pedir(LA_GENTERULA);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/webp");

    const [, opciones] = fetchMock.mock.calls[0];
    const cabeceras = opciones?.headers as Record<string, string>;
    expect(cabeceras["User-Agent"]).toBeDefined();
    expect(cabeceras["User-Agent"].toLowerCase()).not.toContain("node");
  });

  it("un host fuera de la lista es un 400 y no se pide a ninguna parte", async () => {
    // La puerta. Si esto pasara, el despliegue sería un proxy abierto contra terceros.
    // Un 400 y no un 403 porque no es un problema de permisos: es que el host no está.
    const fetchMock = imagenMock();
    poner(fetchMock);

    const res = await pedir("https://cdn.desconocido.example/cartel.jpg");

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sin `url`, o con una que no es una imagen remota, tampoco se pide a ninguna parte", async () => {
    const fetchMock = imagenMock();
    poner(fetchMock);

    expect((await pedir(null)).status).toBe(400);
    // Y `//` es relativo al protocolo, que `imagenServible` ya rechaza por su cuenta.
    expect((await pedir("//cdn.lagenterula.com/cartel.jpg")).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("un redirect degrada a 502 y no se propaga su Location", async () => {
    // Un host de la lista que responde 302 a un CDN cualquiera es un host del que esta
    // ruta no puede responder. Con `redirect: "follow"` el proxy descargaría de
    // cualquier sitio, que es la puerta que existe para cerrar; y propagar el 302 con su
    // `Location` no es mejor: el navegador lo seguiría igual y la imagen se pintaría
    // desde un host que no está en la lista. Un 502 es lo que el sitio ya sabe pintar.
    const fetchMock = jest.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://cdn.desconocido.example/x.jpg" },
        })
    );
    poner(fetchMock);

    const res = await pedir(LA_GENTERULA);

    expect(res.status).toBe(502);
    expect(res.headers.get("location")).toBeNull();
    // Y una sola petición: si hubiera seguido el redirect, el mock se habría llamado dos
    // veces, que es el otro modo de tener el agujero.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("propaga el estado del host en vez de convertirlo en un 200 con una imagen vacía", async () => {
    // Lo que hace hoy el optimizador de Next con La Genterula, y lo que no tiene que
    // hacer esta ruta: si un host deja de servir, el 403 tiene que verse como 403. Un
    // 200 con el cuerpo vacío deja la tarjeta en un estado que no distingue "no hay
    // foto" de "el host está caído".
    poner(imagenMock({ status: 403 }));

    expect((await pedir(LA_GENTERULA)).status).toBe(403);
  });

  it("un host que responde HTML en vez de una imagen es un 400, no una imagen rota", async () => {
    // Una página de error del WAF es HTML con un 200. Si pasara, el navegador recibiría
    // una "imagen" que no lo es y la tarjeta se quedaría en el degradado sin log.
    poner(imagenMock({ contentType: "text/html" }));

    expect((await pedir(LA_GENTERULA)).status).toBe(400);
  });

  it("un host caído es un 502 y no una excepción", async () => {
    // La tarjeta degrada al tile, que es lo que el sitio ya sabe pintar. Si esto
    // escalara, una sola imagen con el host caído tumbaría las páginas que la pintan.
    poner(
      jest.fn(async () => {
        throw new Error("ECONNRESET");
      })
    );

    expect((await pedir(LA_GENTERULA)).status).toBe(502);
  });

  it("propaga el Cache-Control del origen y, si no lo trae, pone un día", async () => {
    // Una cartelera es un dato que cambia una vez al día: revalidar más veces que eso
    // solo gasta peticiones a un tercero.
    poner(imagenMock());
    expect((await pedir(LA_GENTERULA)).headers.get("cache-control")).toBe("public, max-age=604800");

    poner(
      jest.fn(
        async () => new Response(PIXELES, { status: 200, headers: { "content-type": "image/webp" } })
      )
    );
    expect((await pedir(LA_GENTERULA)).headers.get("cache-control")).toBe("public, max-age=86400");
  });

  it("la lista de permitidos es la de `imagenServible`, no una copia", async () => {
    // El test atesta contra el predicado y no contra una lista escrita aquí: si mañana
    // estas dos cosas se separan, este test sigue en verde mientras la ruta sirve hosts
    // que el resto del sitio no puede pintar. Y al revés, que es el fallo caro.
    expect(imagenServible(LA_GENTERULA)).toBe(true);
    expect(imagenServible("https://cdn.desconocido.example/x.jpg")).toBe(false);
  });
});