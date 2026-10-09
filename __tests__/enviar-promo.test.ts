/**
 * `scripts/enviar-promo.ts`, probado como lo que es: un programa.
 *
 * Y lo que más importa aquí no es que mande correo, sino **cuándo no lo manda**. Las dos
 * puertas son el motivo por el que esto se puede automatizar: sin ellas, un scraper caído
 * produce un post con tres eventos y nadie se entera, porque un `[]` por fallo es
 * indistinguible de un día flojo. Ese es el modo de fallo que este repo ya corrigió una
 * vez en `municipal`, `rula`, `farmacias` y `search`.
 *
 * **`descargarImagenes` y la escritura en disco NO van mockeadas.** Van de verdad contra
 * un `fetch` falso y un directorio temporal, porque un test que no descarga nada no puede
 * comprobar ni por dónde se descargó ni qué se escribió. Lo único mockeado es lo que no
 * tiene sentido en un test: el correo.
 */
import { existsSync } from "node:fs";
import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ventanaDelDia } from "@/lib/promo";
import { localDateStr } from "@/lib/utils";

const getAgendaEventos = jest.fn();
const getAgendaSalud = jest.fn();
const sendMail = jest.fn();

jest.mock("@/lib/agenda", () => ({
  getAgendaEventos: () => getAgendaEventos(),
  getAgendaSalud: () => getAgendaSalud(),
}));

jest.mock("@/lib/mail", () => ({
  sendMail: (...a: unknown[]) => (sendMail as (...x: unknown[]) => unknown)(...a),
}));

type Main = () => Promise<void>;

function cargarScript(): Main {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@/scripts/enviar-promo") as { main: Main };
  return mod.main;
}

const BIEN = { scrapedAt: "", sourcesTotal: 37, sourcesOk: 37, sourcesFallidas: [] };

/**
 * Los eventos van con la fecha de la ventana **real**, calculada con `ventanaDelDia`.
 *
 * La ventana se mueve sola con el calendario, así que con una fecha escrita a pelo el
 * test pasa hoy y tumba dentro de dos días sin que nadie haya tocado nada.
 */
const VENTANA = ventanaDelDia(localDateStr(new Date()));

function evento(i: number) {
  return {
    id: `e${i}`,
    slug: `evento-${i}`,
    title: `Evento ${i}`,
    location: "Sala X",
    category: "Conciertos",
    source: "jimmyjazz",
    // Un título largo a propósito: el fundido de días no toca títulos cortos.
    date: `${VENTANA?.desde ?? localDateStr(new Date())}T20:00:00`,
    image: "https://sarrerak.jimmyjazzgasteiz.com/cartel.jpg",
  };
}

function eventos(n: number) {
  return Array.from({ length: n }, (_, i) => evento(i));
}

describe("el script del paquete", () => {
  let exitPrevio: typeof process.exitCode;
  let destino: string;
  let dirEsperado: string;
  let pedidas: string[];
  let fetchSpy: jest.SpyInstance;
  let log: jest.SpyInstance;

  beforeEach(async () => {
    exitPrevio = process.exitCode;
    process.exitCode = undefined;
    process.env.PROMO_PARA = "yo@ejemplo.test";

    destino = await mkdtemp(join(tmpdir(), "promo-"));
    dirEsperado = join(destino, VENTANA?.desde ?? "");
    process.env.PROMO_DESTINO = destino;

    pedidas = [];
    fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation((async (u: string) => {
      pedidas.push(String(u));
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer,
      };
    }) as unknown as typeof fetch);

    // El script avisa por consola y sin esto la salida llena el log del test.
    log = jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});

    getAgendaEventos.mockReset().mockResolvedValue(eventos(5));
    getAgendaSalud.mockReset().mockResolvedValue(BIEN);
    sendMail.mockReset().mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    process.exitCode = exitPrevio;
    fetchSpy.mockRestore();
    log.mockRestore();
    jest.restoreAllMocks();
    delete process.env.PROMO_PARA;
    delete process.env.PROMO_DESTINO;
  });

  it("las únicas peticiones son las imágenes del paquete, nunca su propio despliegue", async () => {
    // Este es el test que muerde. Si alguien vuelve a pedir `/api/promo` o
    // `/api/actividades/*` por HTTP, esto falla aunque las rutas sigan públicas.
    // El `toBeGreaterThan(0)` no es decorativo: sin él un `every()` sobre un array
    // vacío pasa sin comprobar nada, y ese fue el primer borrador de este test.
    await cargarScript()();

    expect(pedidas.length).toBeGreaterThan(0);
    expect(pedidas.every((u) => u.includes("/api/promo/"))).toBe(true);
    expect(pedidas.some((u) => u.includes("?desde="))).toBe(false);
  });

  it("escribe portada, diapositivas y paquete.json en disco", async () => {
    await cargarScript()();

    const ficheros = await readdir(dirEsperado);
    expect(ficheros).toContain("01-portada.png");
    expect(ficheros).toContain("02-evento-0.png");
    expect(ficheros).toContain("paquete.json");
  });

  it("manda el paquete a PROMO_PARA y sale con 0", async () => {
    await cargarScript()();

    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0]).toMatchObject({ to: "yo@ejemplo.test" });
    expect(process.exitCode).toBeUndefined();
  });

  it("escribe los ficheros antes de mandar el correo", async () => {
    // El motivo es que, si el envío falla, lo que se necesita ya está en disco. Se
    // comprueba desde dentro del propio envío: cuando se le llama, la portada ya está.
    let yaEstaba = false;
    sendMail.mockImplementation(async () => {
      yaEstaba = (await readdir(dirEsperado)).includes("01-portada.png");
      return { ok: true };
    });

    await cargarScript()();

    expect(yaEstaba).toBe(true);
  });

  it("cada imagen viaja dos veces: en línea con cid y como adjunto", async () => {
    await cargarScript()();

    const opciones = sendMail.mock.calls[0][0] as {
      attachments: Array<{ contentDisposition: string; cid?: string }>;
    };
    const enLinea = opciones.attachments.filter((a) => a.contentDisposition === "inline");
    const colgadas = opciones.attachments.filter((a) => a.contentDisposition === "attachment");
    // Portada más las diapositivas, y cada una dos veces.
    expect(enLinea.length).toBeGreaterThan(0);
    expect(enLinea).toHaveLength(colgadas.length);
    expect(enLinea[0].cid).toBe("promo-01");
    expect(enLinea[1].cid).toBe("promo-02");
  });

  it("sin destinatario escribe los ficheros, no manda correo y sale con 1", async () => {
    delete process.env.PROMO_PARA;

    await cargarScript()();

    expect(existsSync(dirEsperado)).toBe(true);
    expect(sendMail).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it("si el envío falla, sale con 1 aunque los ficheros ya estén escritos", async () => {
    sendMail.mockResolvedValue({ ok: false, error: "SMTP caído" });

    await cargarScript()();

    expect(existsSync(join(dirEsperado, "01-portada.png"))).toBe(true);
    expect(process.exitCode).toBe(1);
  });

  describe("la puerta de salud", () => {
    it("con una fuente caída no manda correo, no escribe nada y sale con 1", async () => {
      // Ni ficheros: si el agregado está a medias, el paquete que saliera de ahí es
      // medio día, y dejar medio paquete en disco es dejarlo a un clic de publicarse.
      getAgendaSalud.mockResolvedValue({
        ...BIEN,
        sourcesOk: 36,
        sourcesFallidas: [{ id: "rula", error: "sin token" }],
      });

      await cargarScript()();

      expect(existsSync(dirEsperado)).toBe(false);
      expect(sendMail).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
    });

    it("con una fuente caída sin cambiar el recuento tampoco", async () => {
      // Las dos mitades del rojo: `sourcesFallidas` no vacío **o** `sourcesOk` por
      // debajo del total. Mirar solo una de las dos deja un hueco por el que se cuela
      // un agregado degradado.
      getAgendaSalud.mockResolvedValue({
        ...BIEN,
        sourcesFallidas: [{ id: "vam", error: "500" }],
      });

      await cargarScript()();

      expect(sendMail).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
    });
  });

  describe("la puerta del mínimo", () => {
    it("con dos planes escribe los ficheros, no manda correo y sale con 1", async () => {
      // Aquí sí se escribe: el paquete existe y solo es fino, y quien lo encuentre en
      // el disco decide si lo publica.
      getAgendaEventos.mockResolvedValue(eventos(2));

      await cargarScript()();

      expect(existsSync(dirEsperado)).toBe(true);
      expect(sendMail).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
    });
  });
});