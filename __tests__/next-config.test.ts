import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import nextConfig from "../next.config";
import { IMAGE_HOSTS } from "@/lib/image-hosts";
import { isPublicApiRoute } from "@/lib/api-public-routes";

/**
 * CORS e `images.remotePatterns`.
 *
 * `next.config.ts` tenía dos comodines abiertos a la vez:
 *
 * - `Access-Control-Allow-Origin: *` en `source: "/api/:path*"`, o sea también
 *   en las rutas protegidas. Con eso, cualquier sitio podía leer la respuesta de
 *   `/api/v1/events` desde el navegador de un visitante. La clave no lo impide:
 *   la CORS no mira cabeceras, y un `*` en la respuesta hace que el navegador
 *   acepte la lectura haya `x-api-key` o no.
 * - `images.remotePatterns` con `hostname: "**"` para http y https. El
 *   optimizador de Next hace de proxy: con eso cualquiera podía pedir
 *   `/_next/image?url=<lo que sea>` y usarlo para amplificar tráfico contra un
 *   tercero o para servir contenido desde el origen del sitio.
 *
 * Los dos son la misma forma de fallo —«en vez de una lista, un patrón que
 * acepta todo»—. La lista de `images.remotePatterns` sale de medir los scrapers,
 * no de imaginar: `__tests__/next-config.test.ts` comprueba que ningún host esté
 * inventado, es decir, que aparezca en `lib/sources/**` o en los fixtures de los
 * que se extrajeron.
 */

const ROOT = resolve(__dirname, "..");
const ORIGEN = "https://app-de-ejemplo.test";

type Regla = { source: string; headers: { key: string; value: string }[] };

async function reglas(): Promise<Regla[]> {
  const h = nextConfig.headers;
  if (typeof h !== "function") throw new Error("next.config.headers no es una función");
  return (await h()) as Regla[];
}

/** La versión de `path-to-regexp` que usa Next para `source`, para estos casos. */
function encaja(source: string, pathname: string): boolean {
  if (source === pathname) return true;
  const patron = new RegExp(
    "^" +
      source
        .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        .replace(/:path\*/g, ".*")
        .replace(/:[A-Za-z0-9_]+/g, "[^/]+") +
      "$"
  );
  return patron.test(pathname);
}

/**
 * Los headers efectivos de una ruta, como los compone Next: se aplican todas
 * las reglas cuyo `source` encaja y, para una clave repetida, **gana la
 * última**. Por eso el orden de las reglas no es cosmético, y por eso este
 * helper existe en vez de mirar solo la primera coincidencia.
 */
function headersDe(rules: Regla[], pathname: string): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const regla of rules) {
    if (!encaja(regla.source, pathname)) continue;
    for (const { key, value } of regla.headers) salida[key] = value;
  }
  return salida;
}

function conOrigen<T>(valor: string | undefined, fn: () => T): T {
  const previo = process.env.CORS_ORIGIN;
  if (valor === undefined) delete process.env.CORS_ORIGIN;
  else process.env.CORS_ORIGIN = valor;
  try {
    return fn();
  } finally {
    if (previo === undefined) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = previo;
  }
}

async function conOrigenAsync<T>(valor: string | undefined, fn: () => Promise<T>): Promise<T> {
  const previo = process.env.CORS_ORIGIN;
  if (valor === undefined) delete process.env.CORS_ORIGIN;
  else process.env.CORS_ORIGIN = valor;
  try {
    return await fn();
  } finally {
    if (previo === undefined) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = previo;
  }
}

/**
 * Hosts medidos contra el sitio en vivo en vez de contra un fixture.
 *
 * Casi todos salen de `__tests__/fixtures/`, pero las dos carteleras de cine no
 * tienen scraper con fixture —`app/services/boulevard.ts` no tiene ningún test—,
 * así que se midiieron contra la página. Se anotan aquí, con la URL y la fecha,
 * para que la lista siga sin poder crecer a ojo: un host nuevo tiene que
 * aparecer en `lib/sources/**`, en los fixtures, o en este mapa.
 */
const MEDIDOS_EN_VIVO: Record<string, { url: string; cuando: string }> = {
  "es.web.img3.acsta.net": {
    url: "https://www.sensacine.com/cines/cine/E0786/",
    cuando: "2026-09-30",
  },
  "es.web.img2.acsta.net": {
    url: "https://www.sensacine.com/cines/cine/E0786/",
    cuando: "2026-09-30",
  },
};

const PUBLICAS = ["/api/search", "/api/farmacias", "/api/cines/boulevard"];
const PROTEGIDAS = ["/api/v1/events", "/api/fever", "/api/actividades/eventos/proximos"];

describe("la CORS de /api", () => {
  it("las rutas públicas conservan el comodín, porque las llama el navegador", async () => {
    // Sin `*` —o sin un origen explícito— el navegador bloquea la respuesta y la
    // web deja de funcionar: el componente cliente no manda `Origin` ni
    // `x-api-key`, y no puede.
    const rules = await reglas();
    for (const ruta of PUBLICAS) {
      expect({ ruta, allow: headersDe(rules, ruta)["Access-Control-Allow-Origin"] }).toEqual({
        ruta,
        allow: "*",
      });
    }
  });

  it("una ruta protegida no recibe `*` ni con el origen sin configurar", async () => {
    for (const ruta of PROTEGIDAS) {
      // `reglas()` va dentro de `conOrigen` a propósito: `headers()` lee la
      // variable al ejecutarse, no al importarse, así que pedir las reglas antes
      // de fijarla devolvería la lista sin `Access-Control-Allow-Origin` y el
      // test passaría sin comprobar nada.
      const h = await conOrigenAsync(undefined, async () => headersDe(await reglas(), ruta));
      expect({ ruta, allow: h["Access-Control-Allow-Origin"] ?? null }).toEqual({
        ruta,
        allow: null,
      });
    }
  });

  it("una ruta protegida recibe el origen configurado, y solo ese", async () => {
    for (const ruta of PROTEGIDAS) {
      const h = await conOrigenAsync(ORIGEN, async () => headersDe(await reglas(), ruta));
      expect({ ruta, allow: h["Access-Control-Allow-Origin"] }).toEqual({ ruta, allow: ORIGEN });
    }
  });

  it("lo que no es /api no recibe ninguna de las dos", async () => {
    const rules = await reglas();
    for (const ruta of ["/", "/agenda/2026-10", "/evento/noche-de-piano"]) {
      expect({ ruta, allow: headersDe(rules, ruta)["Access-Control-Allow-Origin"] ?? null }).toEqual(
        { ruta, allow: null }
      );
    }
  });

  it("ninguna regla pública se apoya en un comodín de ruta", () => {
    // Una regla con `source: "/api/cines/:path*"` abriría también
    // `/api/cines/cualquier-cosa-nueva`. Es el mismo agujero del
    // `startsWith("/api/actividades")` del middleware, traducido al `source` de
    // Next, así que se comprueba aquí y no se da por buena.
    return reglas().then((rules) => {
      const conParametro = rules
        .filter((r) => r.source !== "/api/:path*")
        .map((r) => r.source)
        .filter((s) => s.includes("*") || s.includes(":"));
      expect(conParametro).toEqual([]);
    });
  });

  it("la regla general de /api va antes que las públicas, para que la pública la pise", async () => {
    // Si el orden se invirtiera, la regla de `/api/:path*` se aplicaría después
    // y su `Access-Control-Allow-Origin` machacaría el `*` de las públicas,
    // rompiendo el buscador y las páginas que consumen esas cuatro rutas. Es el
    // orden justo al revés de lo que parece natural, y por eso se fija con un
    // test.
    const sources = (await reglas()).map((r) => r.source);
    const general = sources.indexOf("/api/:path*");
    const primeraPublica = sources.findIndex((s) => s !== "/api/:path*");
    expect({ general, primeraPublica, hayGeneral: general >= 0 }).toEqual({
      general: 0,
      primeraPublica,
      hayGeneral: true,
    });
  });

  it("sigue permitiendo la cabecera `x-api-key` y el método OPTIONS", async () => {
    // Sin `x-api-key` en `Allow-Headers`, un cliente que sí tiene la clave se
    // come un error de CORS en el preflight y no puede llamar a la API.
    const rules = await reglas();
    const h = conOrigen(ORIGEN, () => headersDe(rules, "/api/v1/events"));
    expect(h["Access-Control-Allow-Headers"]).toMatch(/x-api-key/);
    expect(h["Access-Control-Allow-Methods"]).toMatch(/OPTIONS/);
  });
});

describe("images.remotePatterns", () => {
  const patterns = nextConfig.images?.remotePatterns ?? [];

  it("no hay ningún comodín de host", () => {
    // `hostname: "**"` convertía el optimizador en un proxy abierto. La tentación
    // de `"**"` es que las fuentes cambian de CDN sin avisar; la respuesta es
    // añadir el host a `IMAGE_HOSTS` cuando pase, no dejar la puerta abierta a
    // todo Internet.
    const conComodin = (patterns as { hostname?: string }[])
      .map((p) => p.hostname)
      .filter((h) => h !== undefined && h.includes("*"));
    expect(conComodin).toEqual([]);
  });

  it("no hay comodines de pathname ni de puerto", () => {
    for (const p of patterns as { pathname?: string; port?: string }[]) {
      expect(p.pathname ?? "").not.toMatch(/[*]/);
      expect(p.port ?? "").not.toMatch(/[*]/);
    }
  });

  it("solo https, porque ningún scraper sirve imágenes por http en claro", () => {
    for (const p of patterns as { protocol?: string }[]) {
      expect(p.protocol).toBe("https");
    }
  });

  it("cada host lleva un motivo, porque añadir uno es una decisión consciente", () => {
    for (const h of IMAGE_HOSTS) {
      expect({ hostname: h.hostname, motivo: h.motivo.length > 20 }).toEqual({
        hostname: h.hostname,
        motivo: true,
      });
    }
  });

  it("no hay hosts inventados: todos salen de un scraper o de un fixture", () => {
    // Este es el que impide ampliar la lista a ojo. La lista se midió
    // extrayendo los hosts de los atributos que los scrapers leen —`src`,
    // `data-src`, `data-original`, `srcset`, `image_url`, `featured_image`, el
    // `image` del JSON-LD de Fever— sobre los HTML y JSON de
    // `__tests__/fixtures/`, más los literales de URL que cada scraper
    // concatena. Un host que no aparece en ninguno de los dos sitios no se ha
    // visto servir una imagen: no entra.
    const atestiguados = new Set<string>(Object.keys(MEDIDOS_EN_VIVO));
    for (const dir of [join(ROOT, "lib", "sources"), join(ROOT, "__tests__", "fixtures")]) {
      for (const fichero of ficherosDe(dir)) {
        const txt = readFileSync(fichero, "utf8");
        for (const m of txt.matchAll(/https?:\/\/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g)) {
          atestiguados.add(m[1].toLowerCase());
        }
      }
    }
    const sinAtestiguar = IMAGE_HOSTS.map((h) => h.hostname).filter(
      (h) => !atestiguados.has(h.toLowerCase())
    );
    expect(sinAtestiguar).toEqual([]);
  });

  it("cada host medido en vivo dice de dónde salió y cuándo", () => {
    for (const [hostname, origen] of Object.entries(MEDIDOS_EN_VIVO)) {
      expect({ hostname, url: /^https:\/\//.test(origen.url), cuando: /^\d{4}-\d{2}-\d{2}$/.test(origen.cuando) }).toEqual(
        { hostname, url: true, cuando: true }
      );
    }
  });

  it("no hay hosts medidos en vivo que no estén en la lista", () => {
    // El mapa de arriba es la puerta de atrás de la lista: si alguien añade
    // aquí un host que no se usa, se ve.
    const sinUsar = Object.keys(MEDIDOS_EN_VIVO).filter(
      (h) => !IMAGE_HOSTS.some((x) => x.hostname === h)
    );
    expect(sinUsar).toEqual([]);
  });

  /**
   * Los hosts que aparecen en `lib/sources/**` y no sirven imágenes, con el
   * motivo. Es la lista de la derecha: lo que sale del escaneo y no está en
   * `IMAGE_HOSTS` tiene que aparecer aquí, o en la lista, pero no puede no
   * aparecer en ninguna de las dos.
   *
   * Se escribe a mano a propósito. Es lo que hace que el escaneo de abajo sea
   * utilizable: sin ella, cualquier URL de API o de página obligaría a
   * inflarla, y una lista inflada es una lista en la que nadie distingue.
   */
  const HOSTS_QUE_NO_SIRVEN_IMAGEN: Record<string, string> = {
    "api.euskadi.eus": "es el endpoint del API de cultura de Euskadi (euskadi.ts:3); sus imágenes van aparte",
    "app.vamcultura.es": "es el endpoint del agregador del VAM (vam.ts:3); el `image_url` lo trae cada ficha",
    "cms.deportivoalaves.com": "el scraper del CMS del Deportivo Alavés no tiene campo de imagen, y no está en el registro de la agenda",
    "cofalava.org": "el scraper de farmacias no tiene campo de imagen; `/api/farmacias` no la usa",
    "entradium.com": "es la versión de escritorio de Entradium (entradium.ts:111,125); las imágenes salen de `m.entradium.com`",
    "feverup.com": "es la base de las páginas de evento de Fever; el JSON-LD apunta a sus CDN de imagen",
    "koraliving.com": "es la web de Kora; el `data-src` real sale de sus CDN, que están en la lista",
    "www.eventbrite.es": "es la página de búsqueda de la ciudad; las imágenes llegan de `img.evbuc.com`",
    "www.fundacionvital.eus": "el scraper de Fundación Vital no extrae imagen en absoluto",
  };

  it("todo host literal de un scraper está en la lista o justificado aquí", () => {
    // Este es el que habría pillado el hueco de `www.buscametas.com`. La lista
    // de abajo enumera dieciocho bases fijas a mano, y a mano las listas se
    // quedan cortas: `buscametas.ts:64` construye la imagen igual que
    // `municipal.ts:49` —un literal de host pegado al `src` relativo— y no
    // estaba. Con la lista cerrada, eso son tarjetas con un 400 del optimizador
    // en lugar de una foto.
    //
    // El escaneo no intenta adivinar qué URL es una imagen: recoge todos los
    // hosts literales de `lib/sources/**` y exige que cada uno esté en
    // `IMAGE_HOSTS` o en `HOSTS_QUE_NO_SIRVEN_IMAGEN`. Un scraper nuevo con un
    // host nuevo rompe el test y obliga a decidir, que es lo único que importa.
    const literales = new Set<string>();
    for (const fichero of ficherosDe(join(ROOT, "lib", "sources"))) {
      if (!fichero.endsWith(".ts")) continue;
      for (const m of readFileSync(fichero, "utf8").matchAll(
        /https?:\/\/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g
      )) {
        literales.add(m[1].toLowerCase());
      }
    }

    const enLaLista = new Set(IMAGE_HOSTS.map((h) => h.hostname.toLowerCase()));
    const justificados = new Set(
      Object.keys(HOSTS_QUE_NO_SIRVEN_IMAGEN).map((h) => h.toLowerCase())
    );

    const sinClasificar = [...literales].filter(
      (h) => !enLaLista.has(h) && !justificados.has(h)
    );
    expect(sinClasificar).toEqual([]);
  });

  it("nadie clasifica un host que ya está en la lista como si no fuera imagen", () => {
    // Al revés también: un host en los dos sitios es una contradicción que
    // escondería el hueco anterior en vez de taparlo.
    const enLaLista = new Set(IMAGE_HOSTS.map((h) => h.hostname.toLowerCase()));
    const duplicados = Object.keys(HOSTS_QUE_NO_SIRVEN_IMAGEN)
      .map((h) => h.toLowerCase())
      .filter((h) => enLaLista.has(h));
    expect(duplicados).toEqual([]);
  });

  it("cada clasificación tiene un motivo, porque un `sin motivo` no se revisa", () => {
    for (const [host, motivo] of Object.entries(HOSTS_QUE_NO_SIRVEN_IMAGEN)) {
      expect({ host, motivo: motivo.length > 20 }).toEqual({ host, motivo: true });
    }
  });

  it("cubre los hosts que los scrapers construyen con una base fija", () => {
    for (const hostname of [
      "www.vitoria-gasteiz.org", // municipal.ts:49, fiestas-blanca.ts:41
      "www.gasteizhoy.com", // gasteizhoy.ts:72
      "sarrerak.jimmyjazzgasteiz.com", // jimmyjazz.ts:58
      "entradas.musikaze.com", // musikaze.ts:64
      "helldorado.net", // helldorado.ts:52
      "www.cm-gazteiz.com", // senderismo.ts:62
      "www.buscametas.com", // buscametas.ts:64
      "opendata.euskadi.eus", // euskadi images[].imageUrl
      "www.kulturklik.euskadi.eus", // vam.ts:31
      "arkabia.eus", // arkabia.ts
      "miniature.pintxos.eus", // miniature featuredmedia
      "mercadoabastos.eus", // mercado-abastos
      "www.lagenterula.com", // rula featured_image.large
      "img.evbuc.com", // eventbrite
      "m.entradium.com", // entradium: la base que usa para resolver el `srcset`
      "www.civitatis.com", // civitatis
      "cdn-kora.koragreencity.com", // kora
      "applications-media.feverup.com", // fever image.contentUrl
      "es.web.img3.acsta.net", // sensacine, el scraper del Boulevard
      "florida.reservaentradas.com", // cines, data-original
    ]) {
      expect({ hostname, enLaLista: IMAGE_HOSTS.some((h) => h.hostname === hostname) }).toEqual({
        hostname,
        enLaLista: true,
      });
    }
  });

  it("el patrón de cada host es exactamente ese host, sin rutas ni comodines", () => {
    for (const h of IMAGE_HOSTS) {
      const patronesDelHost = patterns.filter((p) => (p as { hostname?: string }).hostname === h.hostname);
      expect({ hostname: h.hostname, patrones: patronesDelHost.length }).toEqual({
        hostname: h.hostname,
        patrones: 1,
      });
    }
  });

  it("el número de hosts está acotado, para que una ampliación se note", () => {
    // No es un capricho de números: la lista estaba en una entrada —que es
    // decir, "cualquiera"— y ahora mide veintipocos. Si algún día sube a
    // cincuenta, la primera pregunta que hay que poder contestar es qué hace
    // cada una, y ese es el motivo de que el motivo sea obligatorio.
    expect(IMAGE_HOSTS.length).toBeGreaterThanOrEqual(20);
    expect(IMAGE_HOSTS.length).toBeLessThanOrEqual(32);
  });
});

function ficherosDe(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(p);
    }
  };
  walk(dir);
  return out;
}

// La CORS y la autenticación tienen que contar la misma historia, y la forma de
// comprobarlo es que las dos listas salgan del mismo predicado.
describe("la CORS y la autenticación cuentan la misma historia", () => {
  it("lo que la CORS marca como público es público para el middleware", () => {
    for (const ruta of PUBLICAS) expect(isPublicApiRoute(ruta)).toBe(true);
    for (const ruta of PROTEGIDAS) expect(isPublicApiRoute(ruta)).toBe(false);
  });
});
