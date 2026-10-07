import fs from "fs";
import path from "path";

const FIXTURES_DIR = path.join(__dirname, "fixtures", "sources");

export function loadFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), "utf-8");
}

const MESES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/**
 * Reescribe las fechas de un fixture a fechas futuras relativas a hoy.
 *
 * Los fixtures se capturan de sitios reales y traen fechas fijas, asi que
 * cualquier test que descarte el pasado se pudre en cuanto esas fechas pasan.
 * El formato se conserva ("29 de septiembre 2026.") para que el parser siga
 * ejercitandose de verdad.
 */
export function loadFixtureWithFutureDates(
  name: string,
  { daysAhead = 30 }: { daysAhead?: number } = {}
): string {
  const raw = loadFixture(name);
  const base = new Date();
  base.setDate(base.getDate() + daysAhead);

  return raw.replace(
    /Fecha:\s*[^\r\n<]+/g,
    () =>
      `Fecha: ${base.getDate()} de ${MESES_ES[base.getMonth()]} ${base.getFullYear()}.`
  );
}

/**
 * El fixture municipal con **todos** sus eventos en el día `ymd`.
 *
 * **Por qué hay que reescribir las fechas y no usar `loadFixture` tal cual.** El
 * fixture se capturó el 16 de septiembre de 2026 y `getAgendaEventos()` descarta el
 * pasado salvo que se le pida `includePast` —que es lo correcto para la agenda real—.
 * Con las fechas de captura cualquier consumidor del fixture pinta el estado vacío, y
 * un test que lo espera así pasa por el motivo equivocado. Además se pudre en
 * silencio: no falla, solo deja de comprobar nada.
 *
 * Y por qué no se reusa `loadFixtureWithFutureDates`: ese solo reescribe el texto
 * `"Fecha: …"` de los fixtures HTML, y este es un JSON donde la fecha viaja en
 * `fechaInicio` y en `datetime`, en formatos distintos.
 *
 * Que todos los eventos caigan en el **mismo** día es lo que permite que un test
 * distinga "el día que se le pide" de "hoy": con las fechas repartidas, una ventana de
 * un día puede no tener nada por casualidad y el caso pasa sin comprobar la fecha.
 */
export function fixtureMunicipalEn(ymd: string): string {
  const datos = JSON.parse(loadFixture("municipal-response.json")) as Record<
    string,
    { resultados?: Array<Record<string, unknown>> }
  >;

  const yyyymmdd = ymd.replace(/-/g, "");
  // A las 20:00 hora local, con el offset que fija `jest.config.ts` en el proceso
  // principal antes de bifurcar los workers, para que el `new Date(...)` del
  // agregado caiga dentro de la ventana local del día.
  const instante = new Date(`${ymd}T20:00:00`).toISOString();

  for (const seccion of Object.values(datos)) {
    for (const fila of seccion?.resultados ?? []) {
      fila.fechaInicio = yyyymmdd;
      fila.datetime = instante;
      fila.fechaFin = null;
      fila.isCancelado = false;
    }
  }

  return JSON.stringify(datos);
}

/** `YYYY-MM-DD` en hora local, que es como los eventos llevan la fecha. */
export function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

/** Un `YYYY-MM-DD` de `dias` a partir de hoy. */
export function ymdEnDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return ymdLocal(d);
}

/**
 * El pie de un aggregate limpio: solo la fuente municipal.
 *
 * Un test que no la usa se sale a `www.buscametas.com` de verdad, porque
 * `lib/sources/buscametas.ts` es el único fichero del repo que usa `axios` en vez de
 * `fetch` y `mockFetchWith` solo intercepta `global.fetch`. Se nota en el número de
 * eventos —1.504 reales en vez de los del fixture— y en que un test que promete "hoy
 * no tiene nada" encuentra ocho tarjetas.
 */
export function mockSoloMunicipal(fecha: string): void {
  mockFetchWith([{ match: /vitoria-gasteiz\.org/, content: fixtureMunicipalEn(fecha) }]);
}

export type Route = {
  match: RegExp;
  content: string;
  status?: number;
  headers?: Record<string, string>;
};

/**
 * Una ruta que contesta distinto según la URL que se le pide.
 *
 * Es un tipo aparte y no un `content` que admita función porque hay consumidores de
 * `Route` que leen el cuerpo y lo pasan tal cual a `new Response(...)`
 * (`timeout-plazos.test.ts`), y ensanchar el campo les rompería el typecheck a ellos
 * por algo que no necesitan. `Route` sigue siendo un cuerpo fijo; este dice "el cuerpo
 * sale de una función", que es lo que hace falta cuando una misma URL tiene que
 * responder distinto según los parámetros de la query: una ventana de doce meses que
 * satura y un mes que no, en el mismo test.
 */
export type RutaDinamica = Omit<Route, "content"> & {
  content: Route["content"] | ((url: string) => string);
};

export function mockFetchWith(routes: (Route | RutaDinamica)[]) {
  return jest.spyOn(global, "fetch").mockImplementation(async (input: Parameters<typeof fetch>[0]) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof Request
          ? input.url
          : String(input);

    for (const route of routes) {
      if (route.match.test(url)) {
        const body =
          typeof route.content === "function" ? route.content(url) : route.content;
        return new Response(body, {
          status: route.status ?? 200,
          headers: route.headers,
        });
      }
    }

    return new Response("", { status: 200 });
  });
}

export const EMPTY_HTML = "<html><body></body></html>";