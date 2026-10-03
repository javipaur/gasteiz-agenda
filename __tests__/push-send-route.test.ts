import { NextRequest } from "next/server";

/**
 * `/api/push/send` es la puerta de atrás del digest: el cron de Dokploy la llama
 * por HTTP porque el scheduler en proceso depende de que el proceso de Next siga
 * vivo, y si se ha caído no hay nadie a quien reintentar.
 *
 * Con `x-api-key` es una ruta protegida, y esa es exactamente la razón por la que
 * lo que mande quien la llama acaba en las manos de todos los suscriptores. `title`
 * y `body` se recortaban a 120 y 300 caracteres; **`url` no se recortaba ni se
 * validaba**, y `public/sw.js` la pasa a `client.navigate(url)` y a
 * `clients.openWindow(url)` sin mirar el origen. Con la clave de API,
 * `{"url":"https://otro.example/"}` manda a toda la base de suscripciones fuera del
 * sitio. No es una vulnerabilidad teórica: es phishing con el nombre del sitio y
 * con la confianza de una notificación real.
 *
 * `url` es lo único del payload que el service worker usa como destino de una
 * navegación, así que es lo único que tiene que ser del propio sitio o una ruta
 * relativa. Y recortado, porque un cuerpo enorme en un campo de texto también es
 * un empujón para lo que tiene que parsearlo.
 */

type Route = typeof import("@/app/api/push/send/route");

jest.mock("@/lib/digest", () => ({
  buildDailyDigest: jest.fn(async () => ({ title: "digest", body: "cuerpo", url: "/" })),
}));

/** `sendToAll` falso que devuelve el payload que le pasaron, sin tocar la base. */
function rutas(): { POST: Route["POST"]; enviados: unknown[] } {
  jest.resetModules();
  const enviados: unknown[] = [];
  jest.doMock("@/lib/push", () => ({
    sendToAll: jest.fn(async (payload: unknown) => {
      enviados.push(payload);
      return { sent: 1, failed: 0, pruned: 0, total: 1 };
    }),
  }));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@/app/api/push/send/route") as Route;
  return { POST: mod.POST, enviados };
}

function post(cuerpo: unknown): NextRequest {
  return new NextRequest(new URL("https://gasteizclick.test/api/push/send"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
}

const previa = process.env.NEXT_PUBLIC_SITE_URL;

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://gasteizclick.javierpalacio.es";
});

afterAll(() => {
  if (previa === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = previa;
});

describe("POST /api/push/send, el campo url", () => {
  it("una ruta relativa se respeta tal cual", async () => {
    const { POST, enviados } = rutas();

    await POST(post({ title: "t", body: "b", url: "/evento/noche-de-piano" }));

    expect(enviados[0]).toEqual({
      title: "t",
      body: "b",
      url: "/evento/noche-de-piano",
    });
  });

  it("una URL del propio sitio se respeta", async () => {
    // `NEXT_PUBLIC_SITE_URL` es la base del sitio, así que una URL absoluta del
    // mismo origen es correcta y hay que dejarla pasar: es lo que emite
    // `buildDailyDigest` si algún día cambia de forma.
    const { POST, enviados } = rutas();

    await POST(
      post({ title: "t", body: "b", url: "https://gasteizclick.javierpalacio.es/agenda" })
    );

    expect((enviados[0] as { url: string }).url).toBe(
      "https://gasteizclick.javierpalacio.es/agenda"
    );
  });

  it("un destino de otro origen cae a la raíz", async () => {
    // El caso del enunciado. Con la clave de API esto manda a todos los
    // suscriptores a `evil.example`, y `public/sw.js` lo abre en una pestaña
    // nueva sin comprobar nada.
    const { POST, enviados } = rutas();

    await POST(post({ title: "t", body: "b", url: "https://evil.example/" }));

    expect((enviados[0] as { url: string }).url).toBe("/");
  });

  it("ninguna forma de salirse del sitio cuela", async () => {
    // Cada uno de estos es un camino distinto al mismo sitio de phishing, y todos
    // aprovechan la misma confianza: la notificación es del sitio.
    const fuera = [
      "https://evil.example/",
      "http://gasteizclick.javierpalacio.es.evil.example/agenda",
      "//evil.example/",
      "javascript:alert(document.domain)",
      "data:text/html,<script>alert(1)</script>",
      "/\\evil.example/",
      "https://user:pass@gasteizclick.javierpalacio.es@evil.example/",
      "HTTPS://EVIL.EXAMPLE/",
      "https://evil.example",
    ];
    for (const url of fuera) {
      const { POST, enviados } = rutas();
      await POST(post({ title: "t", body: "b", url }));
      expect({ url, recibido: (enviados[0] as { url: string }).url }).toEqual({
        url,
        recibido: "/",
      });
    }
  });

  it("se recorta, porque el campo no era el único sin techo", async () => {
    // `title` y `body` se recortaban a 120 y 300; `url` se quedaba con lo que
    // fuera. Un cuerpo enorme en un campo de texto es también un empujón para el
    // service worker de cada suscriptor.
    const { POST, enviados } = rutas();

    await POST(post({ title: "t", body: "b", url: `/${"a".repeat(50_000)}` }));

    expect((enviados[0] as { url: string }).url.length).toBeLessThanOrEqual(300);
  });

  it("sin url, o con algo que no es una string, va a la raíz", async () => {
    const { POST, enviados } = rutas();

    for (const url of [undefined, null, 42, {}, [], ""]) {
      await POST(post({ title: "t", body: "b", url }));
      expect({ url: String(url), recibido: (enviados[0] as { url: string }).url }).toEqual({
        url: String(url),
        recibido: "/",
      });
    }
  });

  it("el digest sin campos propios sigue saliendo como lo que es", async () => {
    // La ruta también sirve para disparar el digest built-in, y ese caso no lleva
    // `url`: no se toca nada de él.
    const { POST, enviados } = rutas();

    await POST(post({}));

    expect(enviados[0]).toEqual({ title: "digest", body: "cuerpo", url: "/" });
  });
});
