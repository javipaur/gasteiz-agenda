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

describe("la lista de rutas públicas", () => {
  /**
   * La segunda copia de la lista, y a propósito.
   *
   * El contrato de `openapi.yaml` se contrasta contra `PUBLIC_API_ROUTES`, así
   * que doc y código no pueden divergir solos. Lo que no sale de ahí es «esta
   * ruta concreta no debería ser pública»: para eso hace falta alguien que mire
   * y se acuerde. Esta lista es ese alguien, escrito.
   *
   * Añadir una ruta protegida a `PUBLIC_API_ROUTES` rompe la igualdad de este
   * test. Es el motivo de que la lista esté aquí y no solo derivada del disco:
   * derivándola del disco, meter `/api/fever` en la constante lo haría
   * automáticamente público y ningún test protestaría.
   */
  const ESPERADAS: Record<string, string> = {
    "/api/farmacias": "la llama FarmaciasPageClient desde el navegador",
    "/api/push/subscribe": "la llama PushNotifications al pedir permisos",
    "/api/search": "la llaman Header y HeroSearch",
    "/api/vgbus": "la llama BusPageClient",
    "/api/newsletter/subscribe": "alta desde el formulario del navegador",
    "/api/newsletter/confirm": "enlace de confirmación que llega por email",
    "/api/newsletter/unsubscribe": "enlace de baja que llega por email",
    "/api/cines": "documentada en openapi.yaml para apps móviles",
    "/api/cines/boulevard": "documentada en openapi.yaml para apps móviles",
    "/api/cines/florida": "documentada en openapi.yaml para apps móviles",
  };

  it("son exactamente estas diez, y ninguna más", () => {
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
      "/api/log",
    ]) {
      expect({ ruta, publica: isPublicApiRoute(ruta) }).toEqual({ ruta, publica: false });
    }
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

