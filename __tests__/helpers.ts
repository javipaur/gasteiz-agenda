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

export type Route = {
  match: RegExp;
  content: string;
  status?: number;
  headers?: Record<string, string>;
};

export function mockFetchWith(routes: Route[]) {
  return jest.spyOn(global, "fetch").mockImplementation(async (input: Parameters<typeof fetch>[0]) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof Request
          ? input.url
          : String(input);

    for (const route of routes) {
      if (route.match.test(url)) {
        return new Response(route.content, {
          status: route.status ?? 200,
          headers: route.headers,
        });
      }
    }

    return new Response("", { status: 200 });
  });
}

export const EMPTY_HTML = "<html><body></body></html>";