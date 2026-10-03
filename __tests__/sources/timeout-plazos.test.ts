import axios from "axios";

import type { Route } from "../helpers";
import { EMPTY_HTML, mockFetchWith } from "../helpers";

import { fetchEuskadiPage } from "@/lib/sources/euskadi";
import { invalidateMercadoAbastos, scrapeMercadoAbastos } from "@/lib/sources/mercado-abastos";
import { scrapeJimmyJazz } from "@/lib/sources/jimmyjazz";
import { scrapeSenderismo } from "@/lib/sources/senderismo";
import { scrapeVamEvents } from "@/lib/sources/vam";
import { scrapeGasteizHoy } from "@/lib/sources/gasteizhoy";

/**
 * El plazo de las peticiones que salen a la red.
 *
 * `lib/agenda.ts:90` espera a **las 28** fuentes con `Promise.allSettled`, y
 * `lib/cache.ts:59` reparte esa misma promesa a toda petición concurrente de la
 * clave. Las dos son corretas y por eso justamente son el problema: si una fuente
 * no resuelve nunca, no hay ninguna parte del sistema que pueda seguir. Cuelgan la
 * home, `/agenda`, `/culture`, `/deporte`, `/evento/[slug]` y `/api/v1/events`.
 *
 * Y `next: { revalidate }` no es un plazo: cachea la *respuesta*, no impone nada
 * sobre cuánto puede tardar en llegar. Un servidor que acepta la conexión y no
 * contesta se queda ahí indefinidamente con la revalidación puesta.
 *
 * El valor es 20000 en los siete sitios porque es el que ya usa el resto del repo
 * —ocho veces—, o sea la convención y no un número nuevo. Los dos casos que se
 * salen de ella ya lo traían: Rula baja 6,5 MB y tiene 30000, y miniature.ts
 * pagina 10 veces y tiene 90000.
 */

/** El plazo por defecto del repo, nombrado para que el número no viva dos veces. */
const PLAZO = 20000;

type Plazo = { url: string; ms: number };

/**
 * Instrumenta las dos piezas a la vez: qué URL se pide y con qué plazo.
 *
 * El emparejamiento funciona por orden de evaluación, no por sincronía: en
 * `fetch(url, { signal: AbortSignal.timeout(ms) })` el objeto literal —y con él la
 * llamada a `AbortSignal.timeout`— se evalúa **antes** de invocar `fetch`, así que
 * al entrar en el mock de `fetch` el último plazo pedido es el de esa llamada.
 *
 * `AbortSignal.timeout` se suplanta por un `AbortController` vacío y no por la
 * señal real: lo que se comprueba es que el código **pide** un plazo, y montar 7
 * temporizadores de 20 s que nadie dispara en cada test deja handles abiertos
 * para nada.
 */
function instrumentar(routes: Route[]) {
  const plazos: Plazo[] = [];
  let ultimo = 0;

  const timeoutSpy = jest
    .spyOn(AbortSignal, "timeout")
    .mockImplementation((ms?: number) => {
      ultimo = Number(ms ?? 0);
      return new AbortController().signal;
    });

  const fetchSpy = jest
    .spyOn(global, "fetch")
    .mockImplementation(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof Request
            ? input.url
            : String(input);

      if (init?.signal) plazos.push({ url, ms: ultimo });

      const ruta = routes.find((r) => r.match.test(url));
      return new Response(ruta ? ruta.content : "", {
        status: ruta?.status ?? 200,
        headers: ruta?.headers,
      });
    });

  return { plazos, timeoutSpy, fetchSpy };
}

/** El plazo con el que se pidió una URL que contiene `aguja`. */
function plazoDe(plazos: Plazo[], aguja: string): number | undefined {
  return plazos.find((p) => p.url.includes(aguja))?.ms;
}

describe("plazo de las peticiones salientes", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("senderismo", async () => {
    const { plazos } = instrumentar([{ match: /cm-gazteiz\.com/, content: EMPTY_HTML }]);
    await scrapeSenderismo().catch(() => undefined);
    expect(plazoDe(plazos, "cm-gazteiz.com")).toBe(PLAZO);
  });

  it("euskadi", async () => {
    const { plazos } = instrumentar([
      { match: /api\.euskadi\.eus/, content: JSON.stringify({ items: [], totalItems: 0 }) },
    ]);
    await fetchEuskadiPage(1).catch(() => undefined);
    expect(plazoDe(plazos, "api.euskadi.eus")).toBe(PLAZO);
  });

  it("gasteizhoy, en las dos peticiones que hace", async () => {
    // Las dos van en el mismo `Promise.all`: si a una se le olvida el plazo, la
    // otra compensa y el `Promise.all` se queda colgado igual de igual.
    const { plazos } = instrumentar([
      { match: /gasteizhoy\.com/, content: EMPTY_HTML },
    ]);
    await scrapeGasteizHoy().catch(() => undefined);

    const deGasteizhoy = plazos.filter((p) => p.url.includes("gasteizhoy.com"));
    expect(deGasteizhoy.length).toBeGreaterThanOrEqual(2);
    for (const p of deGasteizhoy) expect(p.ms).toBe(PLAZO);
  });

  it("jimmyjazz", async () => {
    const { plazos } = instrumentar([
      { match: /jimmyjazzgasteiz\.com/, content: EMPTY_HTML },
    ]);
    await scrapeJimmyJazz().catch(() => undefined);
    expect(plazoDe(plazos, "jimmyjazzgasteiz.com")).toBe(PLAZO);
  });

  it("mercado-abastos", async () => {
    invalidateMercadoAbastos();
    const { plazos } = instrumentar([
      { match: /tribe\/events/, content: JSON.stringify({ events: [] }) },
    ]);
    await scrapeMercadoAbastos().catch(() => undefined);
    expect(plazoDe(plazos, "tribe/events")).toBe(PLAZO);
  });

  it("vam, en la llamada a la API", async () => {
    // El mismo scraper tiene dos peticiones con vida propia: la de la API y la
    // del `og:image`, que ya traía 8000 y no es la que se está añadiendo plazo.
    const { plazos } = instrumentar([
      { match: /vamcultura\.es/, content: JSON.stringify({ events: [] }) },
      { match: /.*/, content: EMPTY_HTML },
    ]);
    await scrapeVamEvents().catch(() => undefined);
    expect(plazoDe(plazos, "vamcultura.es")).toBe(PLAZO);
  });

  it("buscametas, que usa axios y no fetch", async () => {
    // `fetch` no sirve aquí: `scrapeBuscametasCalendario` hace un POST multipart
    // con `form-data`, y lo que se mira es el `timeout` del config de axios, que
    // es donde axios aplica el plazo. Sin él, un POST colgado cuelga la agenda.
    const postSpy = jest
      .spyOn(axios, "post")
      .mockResolvedValue({ data: { eventos: [] } } as never);

    await import("@/lib/sources/buscametas")
      .then((m) => m.scrapeBuscametasCalendario())
      .catch(() => undefined);

    expect(postSpy).toHaveBeenCalled();
    const config = postSpy.mock.calls[0][2] as { timeout?: number } | undefined;
    expect(config?.timeout).toBe(PLAZO);
  });

  it("mockFetchWith no falsea la cuenta: sigue sirviendo por URL", async () => {
    // Guarda de la anteriores: si el mock devolviera siempre 200 vacío, los siete
    // casos de arriba pasarían sin haber comprobado nada.
    const fetchMock = mockFetchWith([{ match: /cm-gazteiz\.com/, content: "hola" }]);
    const respuesta = await fetch("https://cm-gazteiz.com/actividades/");
    expect(await respuesta.text()).toBe("hola");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("tope de tamaño del cuerpo en jimmyjazz", () => {
  /**
   * `arrayBuffer()` sin tope es la otra mitad del mismo agujero: el plazo acota
   * cuánto se espera, no cuánto se acepta. Una respuesta enorme —o una que se
   * atasca a mitad— se la come entera antes de que el parser la mire.
   */
  const MAX = 2 * 1024 * 1024;

  /** La tarjeta con la que este scraper trabaja, en sus clases de verdad. */
  function tarjeta() {
    return (
      '<div class="mkp-ticket-item">' +
      '<h3 class="mkp-ticket-data-title">Concierto de prueba</h3>' +
      '<span class="mkp-ticket-date-monthday">15</span>' +
      '<span class="mkp-ticket-date-month">oct</span>' +
      '<span class="mkp-ticket-date-year">2030</span>' +
      '<span class="mkp-ticket-data-place">Jimmy Jazz</span>' +
      '<div class="mkp-ticket-image"><img src="/img/a.jpg"></div>' +
      '<a class="btn" href="/entradas/x">Entradas</a>' +
      "</div>"
    );
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("descarta el cuerpo que supera el tope en vez de parsearlo", async () => {
    // Se genera en el test y no como fixture porque el relleno tiene que pesar lo
    // que pesa: un fichero de 2 MB en el repo no se puede abrir ni revisar. La
    // tarjeta es real, o sea que con el código viejo esto devolvía un evento y con
    // el nuevo ninguno — y por eso el caso falla antes de arreglarlo.
    const relleno = "<!--".padEnd(MAX + 1024, "x");
    const html = tarjeta() + relleno;

    mockFetchWith([{ match: /jimmyjazzgasteiz\.com/, content: html }]);

    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    const events = await scrapeJimmyJazz();

    expect(events).toEqual([]);
    // Y se dice por qué, que es lo que evita que esto vuelva a ser un `[]`
    // indistinguible de "no hay gigs".
    expect(errorSpy).toHaveBeenCalledWith(expect.stringMatching(/jimmyjazz/i));
  });

  it("un cuerpo dentro del tope se sigue parseando", async () => {
    // El otro lado de la regla: el tope no puede convertirse en un motivo para
    // devolver siempre vacío.
    mockFetchWith([{ match: /jimmyjazzgasteiz\.com/, content: tarjeta() }]);

    const events = await scrapeJimmyJazz();

    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("Concierto de prueba");
  });
});