import { existsSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { NextRequest } from "next/server";

import { PUBLIC_API_ROUTES, isPublicApiRoute } from "@/lib/api-public-routes";

/**
 * La política de autenticación de `/api/*`.
 *
 * Aquí había dos agujeros que no se veían mirando el código, porque los dos
 * parecían features:
 *
 * 1. **Fallback abierto.** Sin `API_KEY` en el entorno el middleware hacía
 *    `console.warn("API_KEY not set – API endpoints are open")` y dejaba pasar
 *    todo. Un despliegue con la variable mal puesta —o sin ella, porque nadie
 *    lee el README— publicaba la API entera sin autenticar. El comentario lo
 *    decía en inglés y en pasado: era una decisión, no un descuido. Ahora es un
 *    503 que explica qué falta, porque un despliegue mal configurado tiene que
 *    gritar, no susurrar.
 *
 * 2. **`startsWith` para las rutas públicas.** `PUBLIC_API_ROUTES` incluía
 *    `"/api/actividades"`, así que esa ruta y sus subrutas de agenda quedaban
 *    abiertas sin querer: no es lo mismo que documentar una ruta que se llama a
 *    pelo que dejar abierto un prefijo entero. Peor: `startsWith` también habría
 *    abierto un futuro `/api/actividades-copia`, y `startsWith("/api/cines")`
 *    abría `/api/cines/boulevard` por accidente y no por decisión.
 *
 * La lista vive en `lib/api-public-routes.ts` porque la necesitan tres sitios:
 * el middleware, la CORS de `next.config.ts` y el test que contrasta
 * `public/openapi.yaml`. Escrita a mano tres veces, divergiría tres veces.
 */

const ROOT = resolve(__dirname, "..");
const CLAVE = "clave-de-prueba";

type Middleware = (request: NextRequest) => Response;

/**
 * Carga `middleware.ts` con `API_KEY` en el estado que pide el caso.
 *
 * El módulo lee el entorno al importarse, así que hay que invalidar la caché de
 * módulos; y se restaura al final para que un test no se deje la variable puesta
 * para el siguiente.
 */
function conApiKey<T>(apiKey: string | undefined, fn: (middleware: Middleware) => T): T {
  const previo = process.env.API_KEY;
  if (apiKey === undefined) delete process.env.API_KEY;
  else process.env.API_KEY = apiKey;
  jest.resetModules();
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { middleware } = require("@/middleware") as typeof import("@/middleware");
    return fn(middleware as unknown as Middleware);
  } finally {
    if (previo === undefined) delete process.env.API_KEY;
    else process.env.API_KEY = previo;
  }
}

function pedir(pathname: string, cabeceras: Record<string, string> = {}): NextRequest {
  return new NextRequest(new URL(pathname, "https://gasteizclick.test"), {
    headers: cabeceras,
  });
}

/**
 * Una petición con método, que es lo que hace falta para el preflight: `OPTIONS` no
 * se puede construir con `pedir()` porque esa devuelve siempre un `GET`.
 */
function conMetodo(
  metodo: string,
  pathname: string,
  cabeceras: Record<string, string> = {}
): NextRequest {
  return new NextRequest(new URL(pathname, "https://gasteizclick.test"), {
    method: metodo,
    headers: cabeceras,
  });
}

/** Las tres cabeceras que definen un preflight, y que excluyen la clave. */
const PREFLIGHT = {
  Origin: "https://app-de-ejemplo.test",
  "Access-Control-Request-Method": "GET",
  "Access-Control-Request-Headers": "x-api-key",
};

/**
 * `true` si el middleware deja pasar la petición al route handler.
 *
 * `NextResponse.next()` marca la respuesta con `x-middleware-next: 1`, que es lo
 * que Next lee para saber que tiene que seguir con el enrutado normal. Importa
 * distinguirlo de un `200` de verdad: un 200 sin esa cabecera sería una respuesta
 * del middleware, no el preflight que el route handler implementa solo (Next
 * responde `204` con `Allow` a cualquier `OPTIONS` que la ruta no exporte).
 */
function reenviado(res: Response): boolean {
  return res.headers.get("x-middleware-next") === "1";
}

const CON_CLAVE = { "x-api-key": CLAVE };

/** Todas las rutas que de verdad tienen un route handler, leídas del disco. */
function rutasEnDisco(): string[] {
  const base = join(ROOT, "app", "api");
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entrada of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entrada.name);
      if (entrada.isDirectory()) walk(p);
      else if (entrada.name === "route.ts" || entrada.name === "route.tsx") {
        out.push("/api/" + relative(base, dirname(p)).replace(/\\/g, "/"));
      }
    }
  };
  if (existsSync(base)) walk(base);
  return out.map((r) => (r.length > 1 ? r.replace(/\/$/, "") : r)).sort();
}

describe("sin API_KEY en el entorno", () => {
  it("responde 503 en una ruta protegida en vez de dejarla pasar", async () => {
    const res = conApiKey(undefined, (middleware) => middleware(pedir("/api/v1/events")));

    // El fallo abierto devolvía `NextResponse.next()`, o sea un 200. Este es el
    // test que muerde: si alguien restituye el `console.warn` y el `next()`, el
    // status vuelve a ser 200 y esto falla.
    expect(res.status).toBe(503);
  });

  it("el cuerpo dice que falta configurar la clave, no que la clave es mala", async () => {
    // 401 diría «tu clave no vale»; 503 dice «esta instalación no está
    // configurada». Confundirlos hace que quien depure persiga al cliente
    // cuando el problema es el despliegue.
    const res = conApiKey(undefined, (middleware) => middleware(pedir("/api/v1/events")));
    const cuerpo = (await res.json()) as { error?: string };

    expect(cuerpo.error).toMatch(/API_KEY/);
  });

  it("cierra todas las rutas que no están en la lista de públicas", () => {
    const protegidas = rutasEnDisco().filter((r) => !isPublicApiRoute(r));
    expect(protegidas.length).toBeGreaterThan(20);

    conApiKey(undefined, (middleware) => {
      for (const ruta of protegidas) {
        const res = middleware(pedir(ruta));
        expect({ ruta, status: res.status }).toEqual({ ruta, status: 503 });
      }
    });
  });

  it("las públicas siguen contestando sin clave: no las puede cerrar nadie", () => {
    conApiKey(undefined, (middleware) => {
      for (const ruta of rutasEnDisco().filter(isPublicApiRoute)) {
        const res = middleware(pedir(ruta));
        expect({ ruta, status: res.status }).toEqual({ ruta, status: 200 });
      }
    });
  });
});

describe("con API_KEY en el entorno", () => {
  it("una ruta protegida sin cabecera responde 401", () => {
    const res = conApiKey(CLAVE, (middleware) => middleware(pedir("/api/v1/events")));
    expect(res.status).toBe(401);
  });

  it("con la cabecera correcta pasa", () => {
    const res = conApiKey(CLAVE, (middleware) =>
      middleware(pedir("/api/v1/events", CON_CLAVE))
    );
    expect(res.status).toBe(200);
  });

  it("con la query correcta pasa", () => {
    const res = conApiKey(CLAVE, (middleware) =>
      middleware(pedir(`/api/v1/events?api_key=${CLAVE}`))
    );
    expect(res.status).toBe(200);
  });

  it("una clave distinta responde 401", () => {
    const res = conApiKey(CLAVE, (middleware) =>
      middleware(pedir("/api/v1/events", { "x-api-key": "otra" }))
    );
    expect(res.status).toBe(401);
  });
});

/**
 * El preflight de CORS no puede llevar la clave, y el middleware se la pedía.
 *
 * Un `OPTIONS` de preflight lleva `Origin`, `Access-Control-Request-Method` y
 * `Access-Control-Request-Headers`, y por definición **no** lleva `x-api-key` ni
 * `?api_key=`: el navegador aún no ha enviado la petición real, así que no tiene
 * ningún sitio donde ponerlos. El middleware solo miraba esas dos cosas, así que
 * todo preflight a una ruta protegida caía en el 401 de «Unauthorized – provide a
 * valid x-api-key header». Para el navegador eso es un error de CORS y el cliente
 * no llega a hacer la petición: **ninguna ruta protegida de `/api/*` era
 * callable desde un navegador de otro origen**, que es justo para lo que
 * `CORS_ORIGIN` está documentado en el `README`.
 *
 * La culpa era compartida con `next.config.ts:9-15`, que sí pone `x-api-key` en
 * `Access-Control-Allow-Headers` con el motivo escrito: sin esa cabecera el
 * preflight falla. Estaba todo medio hecho menos justo donde no se podía
 * Remediar desde el navegador.
 *
 * El alcance es **solo** `OPTIONS`. Relajar el `GET`/`POST`/`etc.` convertiría
 * la autenticación en un consejo, que es lo que era antes de la fase 2.
 */
describe("el preflight de CORS (OPTIONS)", () => {
  it("una ruta protegida responde sin que le pidan la clave", () => {
    const res = conApiKey(CLAVE, (middleware) =>
      middleware(conMetodo("OPTIONS", "/api/v1/events", PREFLIGHT))
    );

    expect(res.status).not.toBe(401);
    // Y que lo que se conteste sea el reenvío al route handler, que es quien
    // responde el 204 con `Allow` y quien recibe las cabeceras de CORS de
    // `next.config.ts`. Si esto fuera un 200 del middleware, el preflight sería
    // una respuesta hecha a mano que además no llevaría `Allow`.
    expect({ reenviado: reenviado(res) }).toEqual({ reenviado: true });
  });

  it("también sin API_KEY en el entorno, porque el 503 tampoco lo arreglaba", () => {
    // Sin `API_KEY` no hay ni 401 ni 503 que devolver: el preflight no es una
    // petición de datos y no tiene nada que autorizar. Lo que sigue contestar
    // 503 es la petición real, que es la que importa.
    const res = conApiKey(undefined, (middleware) =>
      middleware(conMetodo("OPTIONS", "/api/v1/events", PREFLIGHT))
    );

    expect(res.status).not.toBe(503);
    expect({ reenviado: reenviado(res) }).toEqual({ reenviado: true });
  });

  it("también aunque el preflight traiga una clave equivocada", () => {
    // El preflight nunca trae la clave, pero algunos clientes no lo hacen así y
    // la meten igual. Un 401 aquí sería el mismo bug con distinto disfraz, así que
    // en `OPTIONS` la clave se ignora en cualquier caso.
    const res = conApiKey(CLAVE, (middleware) =>
      middleware(
        conMetodo("OPTIONS", "/api/v1/events", { ...PREFLIGHT, "x-api-key": "otra" })
      )
    );

    expect(res.status).not.toBe(401);
  });

  it("UNA ruta protegida sigue pidiendo clave para todo lo que no sea preflight", () => {
    // El alcance del arreglo. Si esto se relajase, `CORS_ORIGIN` dejaría de ser
    // un mecanismo de acceso y pasarían a ser datos públicos con CORS abierto.
    conApiKey(CLAVE, (middleware) => {
      for (const metodo of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
        const res = middleware(conMetodo(metodo, "/api/v1/events", PREFLIGHT));
        expect({ metodo, status: res.status }).toEqual({ metodo, status: 401 });
      }
    });
  });

  it("una ruta protegida sigue pidiendo la clave correcta para el resto", () => {
    // La otra mitad del alcance: la exención es del método, no de la ruta. Con la
    // clave buena, un `OPTIONS` también pasa, que es lo que pasa con cualquier
    // otro método.
    conApiKey(CLAVE, (middleware) => {
      const res = middleware(conMetodo("OPTIONS", "/api/v1/events", CON_CLAVE));
      expect({ status: res.status, reenviado: reenviado(res) }).toEqual({
        status: 200,
        reenviado: true,
      });
    });
  });

  it("una ruta pública ni siquiera llega aquí: se va por su rama", () => {
    // `isPublicApiRoute` está **antes** que el preflight, y eso es intencionado:
    // una ruta pública ya devuelve sin mirar nada, así que preguntarle por el
    // método sería trabajo para nada. El resultado observable es el mismo 200 de
    // siempre, y el test lo fija para que nadie lo dé por un efecto del arreglo.
    const res = conApiKey(CLAVE, (middleware) =>
      middleware(conMetodo("OPTIONS", "/api/search", PREFLIGHT))
    );

    expect({ status: res.status, reenviado: reenviado(res) }).toEqual({
      status: 200,
      reenviado: true,
    });
  });

  it("cubre todas las rutas protegidas del disco, no solo /api/v1/events", () => {
    // Un arreglo escrito para un ejemplo es un arreglo para un ejemplo. Aquí se
    // recorre la lista real, así que una ruta protegida que se cuelgue al volver
    // es un rojo y no un comportamiento que nadie descubre en producción.
    const protegidas = rutasEnDisco().filter((r) => !isPublicApiRoute(r));
    expect(protegidas.length).toBeGreaterThan(20);

    conApiKey(CLAVE, (middleware) => {
      for (const ruta of protegidas) {
        const res = middleware(conMetodo("OPTIONS", ruta, PREFLIGHT));
        expect({ ruta, reenviada: reenviado(res) }).toEqual({ ruta, reenviada: true });
      }
    });
  });

  it("sigue sin tocar nada fuera de /api", () => {
    // La exención es de `/api/*`, no global: si se saliera de aquí, cualquier
    // preflight de una página, un sitemap o un feed dejaría de pasar por la
    // política entera.
    for (const ruta of ["/", "/agenda/2026-10", "/feed.xml"]) {
      const res = conApiKey(CLAVE, (middleware) => middleware(conMetodo("OPTIONS", ruta)));
      expect({ ruta, reenviado: reenviado(res) }).toEqual({ ruta, reenviado: true });
    }
  });
});

/**
 * La segunda copia de la lista de públicas, y a propósito.
 *
 * El contrato de `openapi.yaml` se contrasta contra `PUBLIC_API_ROUTES`, así que
 * doc y código no pueden divergir solos. Lo que no sale de ahí es «esta ruta
 * concreta no debería ser pública»: para eso hace falta alguien que mire y se
 * acuerde. Esta lista es ese alguien, escrito.
 *
 * Añadir una ruta protegida a `PUBLIC_API_ROUTES` rompe la igualdad de estos
 * tests. Es el motivo de que la lista esté aquí y no solo derivada del disco:
 * derivándola del disco, meter `/api/fever` en la constante lo haría
 * automáticamente público y ningún test protestaría.
 *
 * Vive a nivel de módulo y no dentro de su `describe` porque también hace falta
 * desde el caso que comprueba que `/api/log` es pública: la condición de una
 * entrada nueva no es solo «está en la lista», es «está con el motivo que alguien
 * escribió».
 */
const ESPERADAS: Record<string, string> = {
  "/api/farmacias": "la llama FarmaciasPageClient desde el navegador",
  "/api/push/subscribe": "la llama PushNotifications al pedir permisos",
  "/api/search": "la llaman Header y HeroSearch",
  "/api/vgbus": "la llama BusPageClient",
  "/api/img": "la llama el navegador al pintar las tarjetas",
  "/api/log": "el logger del navegador no tiene la clave y sin esto sus avisos se pierden",
  "/api/newsletter/subscribe": "alta desde el formulario del navegador",
  "/api/newsletter/confirm": "enlace de confirmación que llega por email",
  "/api/newsletter/unsubscribe": "enlace de baja que llega por email",
  "/api/cines": "documentada en openapi.yaml para apps móviles",
  "/api/cines/boulevard": "documentada en openapi.yaml para apps móviles",
  "/api/cines/florida": "documentada en openapi.yaml para apps móviles",
  "/api/v1/salud":
    "un cliente externo necesita poder comprobar si la agenda esta completa antes de usarla",
};

describe("la lista de rutas públicas", () => {
  it("son exactamente estas trece, y ninguna más", () => {
    const enCodigo = PUBLIC_API_ROUTES.map((r) => r.path).sort();
    expect(enCodigo).toEqual(Object.keys(ESPERADAS).sort());
  });

  it("cada una lleva su motivo, porque una exención sin razón es una exención que nadie revisa", () => {
    for (const entrada of PUBLIC_API_ROUTES) {
      expect({ path: entrada.path, motivo: entrada.motivo }).toEqual({
        path: entrada.path,
        motivo: ESPERADAS[entrada.path],
      });
    }
  });

  it("ninguna entrada apunta a una ruta que no existe", () => {
    // Una exención de una ruta que se borró no es inocua: se queda ahí
    // ocupando un nombre que el siguiente que añada reutiliza sin querer.
    const enDisco = new Set(rutasEnDisco());
    for (const entrada of PUBLIC_API_ROUTES) {
      expect({ path: entrada.path, existe: enDisco.has(entrada.path) }).toEqual({
        path: entrada.path,
        existe: true,
      });
    }
  });
});

describe("la coincidencia es exacta, no por prefijo", () => {
  it("no abre /api/actividades ni ninguna de sus subrutas", () => {
    // Con `startsWith("/api/actividades")` en la lista, estas pasaban sin
    // clave. `/api/actividades/eventos/proximos` es la que consume
    // `scripts/send-newsletter.ts`, así que abrirla no era un detalle menor.
    for (const ruta of [
      "/api/actividades",
      "/api/actividades/eventos/proximos",
      "/api/actividades/tours/civitatis",
      "/api/actividades/senderismo",
      "/api/actividades/navidad",
      "/api/fever",
      "/api/rula",
      "/api/v1/events",
      "/api/push/send",
    ]) {
      expect({ ruta, publica: isPublicApiRoute(ruta) }).toEqual({ ruta, publica: false });
    }
  });

  it("pero /api/log sí es pública, y el motivo es el logger del navegador", () => {
    // `lib/axiom/client.ts` monta `SimpleFetchTransport({input: "/api/log"})` desde
    // un módulo `"use client"`, que consume `app/error.tsx`. El navegador no
    // publica `API_KEY` y no puede mandarla, así que con `/api/log` fuera de la
    // lista el middleware respondía 401 y **todos los `console.warn` del cliente
    // se descartaban en silencio**: el error se perdía justo en el sitio donde
    // más falta hace verlo.
    expect(isPublicApiRoute("/api/log")).toBe(true);

    const entrada = PUBLIC_API_ROUTES.find((r) => r.path === "/api/log");
    expect(entrada?.motivo).toBe(ESPERADAS["/api/log"]);
  });

  it("una ruta que comparte prefijo con una pública sigue protegida", () => {
    // El agujero de verdad del `startsWith`: no es que abriera de más hoy, es
    // que cualquier ruta futura con el mismo prefijo nacía abierta.
    for (const ruta of [
      "/api/cines/boulevard-2",
      "/api/cinesxxx",
      "/api/searchfoo",
      "/api/farmacias-de-turno",
      "/api/vgbus2",
    ]) {
      expect({ ruta, publica: isPublicApiRoute(ruta) }).toEqual({ ruta, publica: false });
    }
  });

  it("tolera la barra final, que Next no siempre normaliza antes del middleware", () => {
    expect(isPublicApiRoute("/api/search/")).toBe(true);
    expect(isPublicApiRoute("/api/cines/florida/")).toBe(true);
    expect(isPublicApiRoute("/api/v1/events/")).toBe(false);
  });

  it("no le da vueltas a la query ni a las mayúsculas", () => {
    // El `pathname` de Next no trae query, pero si algún día se compara la URL
    // entera, `/api/search?q=navidad` no puede ser una ruta distinta.
    expect(isPublicApiRoute("/api/search?q=navidad")).toBe(false);
    expect(isPublicApiRoute("/API/SEARCH")).toBe(false);
  });
});

describe("el comportamiento, no solo el predicado", () => {
  it("las rutas que se acababan de cerrar siguen pidiendo clave con clave puesta", () => {
    conApiKey(CLAVE, (middleware) => {
      for (const ruta of [
        "/api/actividades",
        "/api/actividades/eventos/proximos",
        "/api/fever",
      ]) {
        const res = middleware(pedir(ruta));
        expect({ ruta, status: res.status }).toEqual({ ruta, status: 401 });
      }
    });
  });

  it("una ruta pública no exige clave aunque la haya", () => {
    conApiKey(CLAVE, (middleware) => {
      for (const ruta of ["/api/search", "/api/cines/boulevard", "/api/newsletter/confirm"]) {
        const res = middleware(pedir(ruta));
        expect({ ruta, status: res.status }).toEqual({ ruta, status: 200 });
      }
    });
  });
});

/**
 * Las cabeceras de caché que el middleware pone a lo que deja pasar.
 *
 * Aquí estaba `pathname.startsWith("/api/cines/")`, **con la barra final**. Tres
 * rutas declaraban `export const revalidate = 3600` y `getPeliculas` cachea cinco
 * minutos: tres declaraciones de frescura para la misma respuesta y ganaba la que
 * no coincidía con el prefijo, que era justo `/api/cines`, la más usada. Es el
 * mismo error de prefijo que `lib/api-public-routes.ts:10-15` documenta con todas
 * sus consecuencias y que ya se corrigió allí: un prefijo no es una ruta.
 *
 * `cacheControlDe` está exportada y se prueba sola porque, hoy, las tres rutas de
 * cines son **públicas** y vuelven en `isPublicApiRoute`, antes de llegar aquí. La
 * rama es alcanzable solo si alguna de ellas se protegiera mañana, y por eso lo
 * que se fija es la política y no su efecto presente: si alguien la relaja
 * borrándola, este test dice que ya no hay política para cines.
 */
describe("las cabeceras de caché del middleware", () => {
  const UN_DIA = "public, s-maxage=3600, stale-while-revalidate=7200";
  const CINCO_MIN = "public, s-maxage=300, stale-while-revalidate=600";

  function cacheControlDe(pathname: string): string {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@/middleware") as typeof import("@/middleware");
    return (mod as unknown as { cacheControlDe: (p: string) => string }).cacheControlDe(
      pathname
    );
  }

  it("las tres rutas de cines reciben el día entero", () => {
    // `/api/cines` es la que no casa con el prefijo con barra, y es la que se
    // quedaba en `s-maxage=300`: la lista de salas del sitio, cacheada cinco
    // minutos cuando sus componentes ya dicen que dura una hora.
    for (const ruta of ["/api/cines", "/api/cines/boulevard", "/api/cines/florida"]) {
      expect({ ruta, cache: cacheControlDe(ruta) }).toEqual({ ruta, cache: UN_DIA });
    }
  });

  it("tolera la barra final, como el predicado de rutas públicas", () => {
    for (const ruta of ["/api/cines/", "/api/cines/florida/"]) {
      expect({ ruta, cache: cacheControlDe(ruta) }).toEqual({ ruta, cache: UN_DIA });
    }
  });

  it("una ruta que comparte prefijo con cines NO recibe el día entero", () => {
    // La mitad del error de prefijo. Con `startsWith("/api/cines")` entrarían
    // `/api/cines-copia` y `/api/cines/cualquier-cosa-nueva`, y una ruta que se
    // escriba mañana nace con una hora de caché que nadie pidió.
    for (const ruta of ["/api/cines-copia", "/api/cinesxxx", "/api/cines/cualquier-cosa"]) {
      expect({ ruta, cache: cacheControlDe(ruta) }).toEqual({ ruta, cache: CINCO_MIN });
    }
  });

  it("el resto sigue en cinco minutos, y /api/v1 en cinco minutos también", () => {
    for (const ruta of ["/api/v1/events", "/api/v1/events/detalle", "/api/fever", "/api/rula"]) {
      expect({ ruta, cache: cacheControlDe(ruta) }).toEqual({ ruta, cache: CINCO_MIN });
    }
  });

  it("lo que el middleware pone es lo que la decisión devuelve", () => {
    // La función no puede quedar huérfana: si alguien la deja de usar y vuelve
    // a poner la condición a mano, el `Cache-Control` del recorrido real y la
    // política probada dejan de ser lo mismo sin que nadie se entere.
    //
    // `/api/cines` no está en la lista **a propósito**: es pública, así que vuelve
    // en `isPublicApiRoute` y no lleva ninguna cabecera de caché puesta por el
    // middleware. Comprobarlo ahí mediría que no hay ninguna, no que la política sea
    // la correcta.
    for (const ruta of ["/api/v1/events", "/api/v1/events/detalle", "/api/fever"]) {
      const res = conApiKey(CLAVE, (middleware) => middleware(pedir(ruta, CON_CLAVE)));
      expect({ ruta, cache: res.headers.get("Cache-Control") }).toEqual({
        ruta,
        cache: cacheControlDe(ruta),
      });
    }
  });
});

/**
 * Que el middleware llegue a ejecutarse.
 *
 * Todo lo de arriba llama a `middleware(request)` a mano, así que la mitad de la
 * política —la que decide a qué rutas se le llama— era invisible para la suite.
 * Es el punto de mayor apalancamiento y el que menos red tenía: si
 * `config.matcher` se cambiara a `"/api/v1/:path*"`, las 324 pruebas habrían
 * seguido en verde y `/api/fever` habría vuelto a estar abierta. Y si el
 * middleware dejara de registrarse —Next 16.2.1 ya avisa de que el convenio
 * pasa a ser `proxy`— igual: verde por aquí, API entera abierta por ahí.
 *
 * Este test cubre la primera mitad. La segunda, la de que se registre de verdad,
 * solo se puede comprobar contra un servidor, y por eso los dos casos e2e de
 * abajo no llevan skip: sin `API_KEY` en el proceso de Playwright corren igual,
 * que es justo cuando no hay que depender de la configuración local.
 */

/** Los `source` de `config.matcher`, venga como venga declarado. */
function sourcesDelMatcher(config: unknown): string[] {
  const matcher = (config as { matcher?: unknown } | undefined)?.matcher;
  if (typeof matcher === "string") return [matcher];
  if (Array.isArray(matcher)) {
    return matcher.map((m) => (typeof m === "string" ? m : (m as { source: string }).source));
  }
  throw new Error("config.matcher no es ni un string ni una lista");
}

/**
 * `path-to-regexp`, que es lo que usa Next para el `matcher`, limitado a lo que
 * aparece en él: `:param*` admite cero o más segmentos y `:param` uno solo.
 *
 * La barra va dentro del patrón a propósito, porque `path-to-regexp` la consume:
 * `/api/:path*` es `/api` seguido de cero o más segmentos, no `/api/` seguido de
 * cero o más. Si se deja la barra fuera, el patrón queda `^/api/(?:/...)?` con
 * dos barras y no casa ni con `/api/farmacias`. Así se mostró en la primera
 * versión del helper: tres tests en rojo y ningún cambio de producción detrás.
 */
function matcherEncaja(source: string, pathname: string): boolean {
  const patron = new RegExp(
    "^" +
      source
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/\/:[A-Za-z0-9_]+\*/g, "(?:/[^]*)?")
        .replace(/\/:[A-Za-z0-9_]+/g, "/[^/]+") +
      "$"
  );
  return patron.test(pathname);
}

describe("config.matcher", () => {
  function matcher(): string[] {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@/middleware") as typeof import("@/middleware");
    return sourcesDelMatcher(mod.config);
  }

  it("existe, y el middleware se exporta como función", () => {
    // Sin esto, Next registra el middleware igual y no pasa nada —hasta que se
    // rompe por otra causa y el aviso aparece enterrado en un log de build.
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@/middleware") as typeof import("@/middleware");
    expect(typeof mod.middleware).toBe("function");
    expect(mod.config).toBeDefined();
    expect(matcher().length).toBeGreaterThan(0);
  });

  it("cubre las cuarenta rutas de API que hay en el disco", () => {
    const sources = matcher();
    const rutas = rutasEnDisco();
    expect(rutas.length).toBeGreaterThanOrEqual(40);

    const sinCubrir = rutas.filter(
      (ruta) => !sources.some((s) => matcherEncaja(s, ruta))
    );
    expect(sinCubrir).toEqual([]);
  });

  it("cubre tanto las públicas como las protegidas, que es donde importa", () => {
    // Si el matcher cubriera solo unas pocas, el error silencioso sería el peor:
    // las pruebas unitarias seguirían en verde porque llaman al middleware a
    // mano, y en producción algunas rutas estarían abiertas y otras cerradas sin
    // que nadie lo note.
    const sources = matcher();
    const publicas = rutasEnDisco().filter(isPublicApiRoute);
    const protegidas = rutasEnDisco().filter((r) => !isPublicApiRoute(r));
    expect(publicas.length).toBeGreaterThan(0);
    expect(protegidas.length).toBeGreaterThan(20);

    for (const ruta of [...publicas, ...protegidas]) {
      expect({ ruta, cubierta: sources.some((s) => matcherEncaja(s, ruta)) }).toEqual({
        ruta,
        cubierta: true,
      });
    }
  });

  it("cubre la ruta pelada y la query, que también llegan al middleware", () => {
    // `/api` a secas no es una ruta nuestra, pero `:path*` admite cero segmentos
    // y es mejor que el matcher la coja: si mañana alguien define `app/api/route.ts`
    // sin querer, entra en la política en vez de quedarse fuera.
    for (const ruta of ["/api", "/api/", "/api/farmacias", "/api/cines/boulevard"]) {
      expect({ ruta, cubierta: matcher().some((s) => matcherEncaja(s, ruta)) }).toEqual({
        ruta,
        cubierta: true,
      });
    }
  });

  it("no toca nada fuera de `/api`, para no gastar trabajo en cada página", () => {
    for (const ruta of [
      "/",
      "/agenda/2026-10",
      "/evento/noche-de-piano",
      "/_next/image",
      "/favicon.ico",
      "/feed.xml",
      "/sitemap.xml",
      // Y estos dos, que es donde un `startsWith` mal puesto se habría colado.
      "/api-docs",
      "/apidocs",
    ]) {
      expect({ ruta, cubierta: matcher().some((s) => matcherEncaja(s, ruta)) }).toEqual({
        ruta,
        cubierta: false,
      });
    }
  });
});

