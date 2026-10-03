/**
 * `/api/push/subscribe` es pública y no puede dejar de serlo: la necesita
 * `PushNotifications` al pedir permisos, y el cliente no tiene `API_KEY` ni puede
 * obtenerla —es la razón de ser de toda `PUBLIC_API_ROUTES`.
 *
 * Esa condición es exactamente la que hace obligatoria la validación. Antes solo
 * se miraba el tipo y que el endpoint empezase por `https://`, y por la misma vía
 * pública se podía:
 *
 * - escribir filas sin límite de tamaño, hasta llenar `.data/push.db`, que
 *   `listSubscriptions()` carga entero en memoria en cada digest;
 * - meter un endpoint que no es un push service, con lo que cada fila se
 *   convertía en una petición HTTPS saliente a un destino elegido por quien
 *   escribe —`https://169.254.169.254/...` incluido—;
 * - **borrar la suscripción de otra persona**, porque el `DELETE` solo comprobaba
 *   que `endpoint` fuera una string. Con `Access-Control-Allow-Origin: *`, desde
 *   cualquier origen.
 *
 * Los tests atacan las tres cosas por separado porque se rompen de forma
 * independiente: un límite de tamaño no protege el `DELETE`, y validar el `POST`
 * no dice nada del borrado.
 */

import { dbDePrueba, limpiarDbsDePrueba, suscripcion } from "./helpers-push";

type Route = typeof import("@/app/api/push/subscribe/route");

function rutas(): { POST: Route["POST"]; DELETE: Route["DELETE"] } {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@/app/api/push/subscribe/route") as Route;
  return { POST: mod.POST, DELETE: mod.DELETE };
}

function pedir(metodo: "POST" | "DELETE", cuerpo: unknown): Request {
  return new Request("https://gasteizclick.test/api/push/subscribe", {
    method: metodo,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
}

function cuerpoValido(over: Partial<{ endpoint: string; p256dh: string; auth: string }> = {}) {
  const base = suscripcion(over.endpoint ?? "https://fcm.googleapis.com/fcm/send/abc123");
  return {
    endpoint: over.endpoint ?? base.endpoint,
    keys: { p256dh: over.p256dh ?? base.keys.p256dh, auth: over.auth ?? base.keys.auth },
  };
}

/** Lo que hay en la base ahora mismo, leída del módulo recién cargado. */
function suscripciones() {
  // `require` y no `import` porque `lib/push.ts` guarda la conexión SQLite en una
  // variable de módulo: hace falta `resetModules` antes de cada lectura para que
  // apunte a la base del caso, y un `import` estático se resolvería una vez para
  // todo el fichero. Es el mismo motivo por el que existe `helpers-push.ts`.
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { listSubscriptions } = require("@/lib/push") as typeof import("@/lib/push");
  return listSubscriptions();
}

beforeEach(() => {
  dbDePrueba();
});

afterAll(() => {
  limpiarDbsDePrueba();
});

describe("alta de suscripción: lo que se rechaza", () => {
  it("un endpoint enorme", async () => {
    // El ataque de Filling: la ruta es pública y no ponía techo. Con 5 MB por
    // petición, la base crecía sin límite.
    const { POST } = rutas();
    const enorme = `https://fcm.googleapis.com/fcm/send/${"A".repeat(200_000)}`;

    const res = await POST(pedir("POST", cuerpoValido({ endpoint: enorme })) as never);

    expect(res.status).toBe(400);
  });

  it(" unas claves enormes", async () => {
    const { POST } = rutas();

    const res = await POST(
      pedir("POST", cuerpoValido({ p256dh: "A".repeat(100_000) })) as never
    );

    expect(res.status).toBe(400);
  });

  it("claves que no son base64", async () => {
    // No es decorativo: la clave viaja como cuerpo de la petición al push
    // service, y un endpoint elegido por quien escribe convierte la fila en una
    // petición saliente arbitraria.
    const { POST } = rutas();

    const res = await POST(
      pedir("POST", cuerpoValido({ auth: "no es base64 ✉" })) as never
    );

    expect(res.status).toBe(400);
  });

  it("un endpoint que no es https", async () => {
    const { POST } = rutas();
    const res = await POST(
      pedir("POST", cuerpoValido({ endpoint: "http://fcm.googleapis.com/x" })) as never
    );
    expect(res.status).toBe(400);
  });

  it("cualquier red que no pueda ser un push service", async () => {
    // Antes solo se comprobaba `startsWith("https://")`, así que cada una de estas
    // se guardaba y se convertía en una petición HTTPS saliente a un destino
    // elegido por quien escribe. No se puede listar los push services de verdad
    // —Firefox, Chrome, Safari y Windows usan hosts distintos—, pero las redes
    // locales nunca son uno.
    const { POST } = rutas();
    const objetivo = [
      "https://169.254.169.254/latest/meta-data/iam/security-credentials/",
      "https://127.0.0.1:8080/",
      "https://10.0.0.5/",
      "https://192.168.1.1/",
      "https://172.16.0.1/",
      "https://[::1]/",
      "https://[fe80::1]/",
      "https://localhost/",
      "https://sub.localhost/",
    ];
    for (const endpoint of objetivo) {
      const res = await POST(pedir("POST", cuerpoValido({ endpoint })) as never);
      expect({ endpoint, status: res.status }).toEqual({ endpoint, status: 400 });
    }
  });

  it("un endpoint sin host, o con un host que no puede ser un push service", async () => {
    const { POST } = rutas();
    for (const endpoint of ["https://", "https://localhost/x", "no-es-una-url"]) {
      const res = await POST(pedir("POST", cuerpoValido({ endpoint })) as never);
      expect({ endpoint, status: res.status }).toEqual({ endpoint, status: 400 });
    }
  });

  it("JSON inválido", async () => {
    const { POST } = rutas();
    const res = await POST(
      new Request("https://gasteizclick.test/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{ esto no es json",
      }) as never
    );
    expect(res.status).toBe(400);
  });
});

describe("alta de suscripción: lo que se acepta", () => {
  it("una suscripción con la forma real de un push service", async () => {
    const { POST } = rutas();
    const res = await POST(pedir("POST", cuerpoValido()) as never);
    expect(res.status).toBe(201);
  });

  it("no rompe las suscripciones ya guardadas", async () => {
    // La poda de 404/410 depende de que `addSubscription` siga guardando lo que
    // le llega; esta es la comprobación de que el endurecimiento de la validación
    // no ha roto el camino bueno.
    const { POST } = rutas();
    expect((await POST(pedir("POST", cuerpoValido()) as never)).status).toBe(201);

    expect(suscripciones()).toHaveLength(1);
  });
});

describe("baja de suscripción", () => {
  it("no acepta un endpoint que no sea una URL https válida", async () => {
    // Aquí estaba el agujero: la condición era `typeof endpoint === "string"`, así
    // que basta con conocer el endpoint de otra persona para borrarla, y la ruta
    // es pública con CORS abierto.
    const { DELETE } = rutas();

    for (const endpoint of [
      "cualquier cosa",
      "",
      "http://fcm.googleapis.com/x",
      "javascript:alert(1)",
      "https://",
      `https://fcm.googleapis.com/${"A".repeat(200_000)}`,
    ]) {
      const res = await DELETE(pedir("DELETE", { endpoint }) as never);
      expect({ endpoint: endpoint.slice(0, 40), status: res.status }).toEqual({
        endpoint: endpoint.slice(0, 40),
        status: 400,
      });
    }
  });

  it("no borra nada cuando el endpoint es inválido", async () => {
    const { POST, DELETE } = rutas();
    await POST(pedir("POST", cuerpoValido()) as never);

    await DELETE(pedir("DELETE", { endpoint: "nada que ver" }) as never);

    expect(suscripciones()).toHaveLength(1);
  });

  it("sigue dando de baja una suscripción propia con su endpoint real", async () => {
    const { POST, DELETE } = rutas();
    const objetivo = cuerpoValido({ endpoint: "https://fcm.googleapis.com/fcm/send/mia" });
    await POST(pedir("POST", objetivo) as never);

    const res = await DELETE(pedir("DELETE", { endpoint: objetivo.endpoint }) as never);

    expect(res.status).toBe(200);
    expect(suscripciones()).toHaveLength(0);
  });
});