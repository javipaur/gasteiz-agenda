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

import type { PaquetePromo } from "@/lib/promo";
import { ventanaDelDia } from "@/lib/promo";
import { localDateStr } from "@/lib/utils";

// **Solo `getAgendaSalud`, y el motivo es que el script ya no pide los eventos.** Antes el
// script montaba la lista en local y necesitaba `getAgendaEventos`; ahora pide el paquete
// ya montado y lo único que lee del agregador es la puerta de salud. Dejar el otro mock
// sin usar daría a entender una dependencia que ya no está.
const getAgendaSalud = jest.fn();
const sendMail = jest.fn();

jest.mock("@/lib/agenda", () => ({
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

const usarReloj = jest;

/**
 * Los eventos van con la fecha de la ventana **real**, calculada con `ventanaDelDia`.
 *
 * La ventana se mueve sola con el calendario, así que con una fecha escrita a pelo el
 * test pasa hoy y tumba dentro de dos días sin que nadie haya tocado nada.
 *
 * **Y si hoy no es día de publicar, se usa el jueves siguiente.** El caso de `null` —domingo
 * a miércoles— no es un borde raro: son cuatro días de cada siete, y el test fallaba los
 * cuatro. Los scripts no escriben nada porque `ventanaDelDia` dice que hoy no toca, que es
 * exactamente lo que tienen que hacer: el test estaba probando el día equivocado y
 * eso se lee como un fallo del script.
 *
 * El caso de `null` **no se pierde**: `scripts/casting.ts` y el propio `main` lo tratan
 * como respuesta correcta, y la tabla de los siete días está en `ventana-del-dia.test.ts`.
 */
function fechaDePrueba(): string {
  const hoy = localDateStr(new Date());
  const directa = ventanaDelDia(hoy);
  if (directa) return directa.desde;

  // Martes: el jueves es el siguiente día que publica.
  for (let salto = 1; salto <= 7; salto += 1) {
    const dia = new Date(`${hoy}T12:00:00`);
    dia.setDate(dia.getDate() + salto);
    const siguiente = ventanaDelDia(localDateStr(dia));
    if (siguiente) return siguiente.desde;
  }
  throw new Error("ventanaDelDia no devolvió ninguna ventana en siete días");
}

const VENTANA = { desde: fechaDePrueba(), hasta: fechaDePrueba() };

function evento(i: number) {
  return {
    id: `e${i}`,
    slug: `evento-${i}`,
    title: `Evento ${i}`,
    location: "Sala X",
    category: "Conciertos",
    source: "jimmyjazz",
    // Un título largo a propósito: el fundido de días no toca títulos cortos.
    // `VENTANA.desde` a pelo y no con `?.`: ahora es siempre una fecha que publica, y el
    // `??` escondía justo el caso que rompía el test.
    date: `${VENTANA.desde}T20:00:00`,
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
  let paqueteDePrueba: PaquetePromo;
  let fetchSpy: jest.SpyInstance;
  let log: jest.SpyInstance;

  beforeEach(async () => {
    exitPrevio = process.exitCode;
    process.exitCode = undefined;
    process.env.PROMO_PARA = "yo@ejemplo.test";

    /*
     * **El reloj se fija en el día que el test está probando.**
     *
     * Sin esto, el script decide con la fecha de hoy y no con la del test, y `ventanaDelDia`
     * dice que no se publica cuatro días de cada siete —domingo a miércoles—. El test
     * pasaba los jueves y fallaba los demás, y el motivo era que estaba probando el día
     * equivocado, no que el script estuviera roto.
     *
     * Se usa `setSystemTime` y no `jest.spyOn(Date, "now")` porque `localDateStr` construye
     * un `new Date()` y lee el reloj del sistema. `nextTick` y `queueMicrotask` quedan fuera
     * del falso porque las promesas del test los usan para resolverse, y `setSystemTime`
     * solo tiene que fijar la fecha.
     */
    usarReloj.useFakeTimers({ doNotFake: ["nextTick", "queueMicrotask"] });
    usarReloj.setSystemTime(new Date(`${VENTANA.desde}T09:00:00Z`));

    destino = await mkdtemp(join(tmpdir(), "promo-"));
    dirEsperado = join(destino, VENTANA.desde);
    process.env.PROMO_DESTINO = destino;

    pedidas = [];
    // El paquete que "devuelve producción". Sus URLs son las de `ORIGEN_PROMO` de verdad,
    // así que el test comprueba la cadena entera —pedir el paquete y bajar sus imágenes—
    // sin tocar la red. Cada imagen se sirve con la firma del PNG, que es lo que
    // distingue un 200 de un 404 en la vida real.
    const paqueteDePruebaBase = {
      pie: "",
      texto: "HOY en Vitoria-Gasteiz: 5 planes que recomendamos.",
      enlace: "",
    };
    const ventana = `${VENTANA.desde}&hasta=${VENTANA.hasta}`;
    paqueteDePrueba = {
      ...paqueteDePruebaBase,
      portada: `https://gasteizclick.javierpalacio.es/api/promo/${VENTANA.desde}/portada`,
      imagenes: eventos(5).map((e) =>
        `https://gasteizclick.javierpalacio.es/api/promo/${VENTANA.desde}/evento/${e.slug}`
      ),
      titulos: eventos(5).map((e) => e.title),
      pie: `https://gasteizclick.javierpalacio.es/hoy?desde=${ventana}`,
      enlace: `https://gasteizclick.javierpalacio.es/hoy?desde=${ventana}`,
    };

    fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation((async (u: string) => {
      pedidas.push(String(u));
      if (u.includes("/api/promo?")) {
        return { ok: true, status: 200, json: async () => paqueteDePrueba };
      }
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

    getAgendaSalud.mockReset().mockResolvedValue(BIEN);
    sendMail.mockReset().mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    process.exitCode = exitPrevio;
    // **El reloj vuelve al real**, o el siguiente describe hereda la fecha fija y mide
    // el martes un caso que no tiene que ver con los martes.
    usarReloj.useRealTimers();
    fetchSpy.mockRestore();
    log.mockRestore();
    jest.restoreAllMocks();
delete process.env.PROMO_PARA;
  delete process.env.PROMO_DESTINO;
  // La del post de presentación también, o el test que la pone contaminaría a los que
  // vienen después y todos creerían que viene de serie.
  delete process.env.PROMO_CON_PRESENTACION;
  });

  it("pide el paquete a producción y descarga solo sus imágenes", async () => {
    // Este test cambió de signo a propósito, y conviene que se sepa por qué.
    //
    // Antes afirmaba lo contrario: que el script **nunca** debía pedir `/api/promo`,
    // porque el criterio era que un script del repo no debe depender de su despliegue.
    // Ese criterio era correcto aplicado a los **datos**, y quedó equivocado aplicado a
    // las **imágenes**: el script seguía montando la lista en local mientras pedía las
    // imágenes al despliegue, y eran dos copias de la misma verdad calculadas en
    // instantes distintos. Medido: los slugs que la lista local pedía y la caché del
    // despliegue no conocía devolvían 404, y el correo no salía.
    //
    // Lo que se afirma ahora es la regla que evita aquello: **una sola copia de la
    // lista**, la de quien dibuja. Se pide el paquete una vez, con su ventana, y todas
    // las URLs que se descargan tienen que venir de ahí.
    //
    // El `toBeGreaterThan(0)` no es decorativo: sin él un `every()` sobre un array vacío
    // pasa sin comprobar nada.
    await cargarScript()();

    const delPaquete = pedidas.filter((u) => u.includes("/api/promo?"));
    expect(delPaquete).toHaveLength(1);
    expect(delPaquete[0]).toContain(`desde=${VENTANA.desde}`);
    expect(delPaquete[0]).toContain(`hasta=${VENTANA.hasta}`);

    // Y se baja la portada **más** las diapositivas del paquete, y nada más. El `+ 1` es la
    // portada, que va aparte en `paquete.portada` y no está en `imagenes`: si mañana el
    // script añadiera una URL de su cuenta, el recuento lo delata.
    const imagenes = pedidas.filter((u) => u.includes("/api/promo/"));
    expect(imagenes).toHaveLength(paqueteDePrueba.imagenes.length + 1);
    expect(imagenes).toEqual(expect.arrayContaining(paqueteDePrueba.imagenes));
    expect(imagenes).toContain(paqueteDePrueba.portada);
  });

  it("falla con un error claro si el paquete trae más títulos que imágenes", async () => {
    // El desajuste entre títulos e imágenes es el síntoma del bug que se corrigió: si
    // el paquete se monta en un sitio y se nombra en otro, aparece como un 404 más
    // adelante. Se comprueba en la puerta, no al descargar.
    paqueteDePrueba.titulos = [...paqueteDePrueba.titulos, "un título de más"];

    await expect(cargarScript()()).rejects.toThrow(/títulos para/);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("falla con un error claro si producción no responde", async () => {
    fetchSpy.mockImplementation((async (u: string) => {
      pedidas.push(String(u));
      if (String(u).includes("/api/promo?")) {
        return { ok: false, status: 503, arrayBuffer: async () => new ArrayBuffer(0) };
      }
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer,
      };
    }) as unknown as typeof fetch);

    await expect(cargarScript()()).rejects.toThrow(/HTTP 503/);
    expect(sendMail).not.toHaveBeenCalled();
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
    it("con una fuente no tolerable caída no manda correo, no escribe nada y sale con 1", async () => {
      // Ni ficheros: si el agregado está a medias, el paquete que saliera de ahí es
      // medio día, y dejar medio paquete en disco es dejarlo a un clic de publicarse.
      //
      // **Usa `vam` y no `rula` a propósito.** La versión anterior de este test usaba
      // `rula`, y `rula` pasó a ser tolerable —es la única fuente con credencial—, así que
      // el test que fijaba "una fuente caída para el envío" dejó de describir el
      // comportamiento. Un ejemplo que se queda viejo sin que nadie lo note es la razón por
      // la que los casos intolerance se nombran de forma explícita.
      getAgendaSalud.mockResolvedValue({
        ...BIEN,
        sourcesOk: 36,
        sourcesFallidas: [{ id: "vam", error: "500" }],
      });

      await cargarScript()();

      expect(existsSync(dirEsperado)).toBe(false);
      expect(sendMail).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
    });

    it("con rula caída sí publica, porque es la única tolerable", async () => {
      // **Este es el cambio, y el motivo está medido.** `rula` es la única fuente que
      // depende de `MEC_TOKEN` y de que La Genterula esté en pie. Un 500 suyo dejó el cron
      // sin poder publicar durante días, con las otras 36 fuentes perfectamente sanas. Se
      // pierde el 3% de los eventos y se publica el 97%.
      getAgendaSalud.mockResolvedValue({
        ...BIEN,
        sourcesOk: 36,
        sourcesFallidas: [{ id: "rula", error: "MEC API returned 500" }],
      });

      await cargarScript()();

      expect(sendMail).toHaveBeenCalledTimes(1);
      expect(existsSync(join(dirEsperado, "01-portada.png"))).toBe(true);
      expect(process.exitCode).toBeUndefined();
    });

    it("con rula y otra caída no publica, porque ya no es solo la tolerable", async () => {
      // **La tolerancia no se extiende en cadena.** `rula` cae y es tolerable; `vam` además
      // cae y no lo es. Ahí ya no es "una fuente con credencial", es un agregado a medias de
      // verdad, y el paquete sería medio día.
      getAgendaSalud.mockResolvedValue({
        ...BIEN,
        sourcesOk: 35,
        sourcesFallidas: [
          { id: "rula", error: "500" },
          { id: "vam", error: "500" },
        ],
      });

      await cargarScript()();

      expect(sendMail).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
    });

    it("con casi todo caído no publica aunque solo caigan tolerables", async () => {
      // La mitad del agregado es la línea, y no el recuento. Con `sourcesOk` por debajo de
      // la mitad el paquete ya no es la agenda de Vitoria por mucho que las que caigan sean
      // pocas: aquí no hay tolerables, y la comprobación es la del agregado entero.
      getAgendaSalud.mockResolvedValue({
        ...BIEN,
        sourcesTotal: 37,
        sourcesOk: 10,
        sourcesFallidas: [{ id: "rula", error: "500" }],
      });

      await cargarScript()();

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

describe("el post de presentación", () => {
  it("no se manda salvo que PROMO_CON_PRESENTACION=1", async () => {
    // **Que no salga por defecto es el comportamiento, no una falta.** El post de
    // presentación no caduca —el carrusel cambia cada mañana—, así que mandarlo todas las
    // semanas solo consigue que deje de leerse. Quien decide cuándo presentarlo es la
    // persona, y para eso está la variable.
    await cargarScript()();

    const opciones = sendMail.mock.calls[0][0] as {
      attachments: Array<{ filename: string; cid?: string }>;
      html: string;
    };
    expect(opciones.attachments.some((a) => a.filename === "presentacion.png")).toBe(false);
    expect(opciones.html).not.toContain("presentacion");
  });

  it("con PROMO_CON_PRESENTACION=1 viaja con su cid, su texto y su enlace", async () => {
    process.env.PROMO_CON_PRESENTACION = "1";

    await cargarScript()();

    const opciones = sendMail.mock.calls[0][0] as {
      attachments: Array<{ filename: string; contentDisposition: string; cid?: string }>;
      html: string;
    };
    const suyas = opciones.attachments.filter((a) => a.filename === "presentacion.png");

    // Inline y colgada, como el resto: sin la copia `attachment` el correo llega sin
    // fotos en el cliente de iOS.
    expect(suyas).toHaveLength(2);
    expect(suyas.map((a) => a.contentDisposition).sort()).toEqual(["attachment", "inline"]);

    // **El cid es `presentacion` y no `promo-08`, y el test lo fija.** Es lo que impide
    // que en el correo se lea como una diapositiva más: numerada, alguien la sube
    // thinking que es la primera del carrusel.
    const enLinea = suyas.find((a) => a.contentDisposition === "inline");
    expect(enLinea?.cid).toBe("presentacion");
    expect(suyas.some((a) => (a.cid ?? "").startsWith("promo-"))).toBe(false);

    expect(opciones.html).toContain("cid:presentacion");
    expect(opciones.html).toContain("POST ADICIONAL");
    expect(opciones.html).toContain("tiene agenda de sobra");
  });

  it("no aparece numerada como diapositiva del carrusel", async () => {
    // La prueba de que la separación es real y no de aspecto: en el HTML, el bloque de la
    // presentación va después del pie del carrusel, no intercalado en la lista numerada.
    process.env.PROMO_CON_PRESENTACION = "1";

    await cargarScript()();

    const opciones = sendMail.mock.calls[0][0] as { html: string };
    const enLaPresentacion = opciones.html.indexOf("cid:presentacion");
    const ultimoNumero = opciones.html.lastIndexOf("promo-06");

    expect(enLaPresentacion).toBeGreaterThan(ultimoNumero);
    // Y el texto del post de presentación está en su propio bloque, con su pie.
    expect(opciones.html.indexOf("Pie del post de presentación")).toBeGreaterThan(
      ultimoNumero
    );
  });

  it("si la imagen no se baja, el carrusel se manda igualmente", async () => {
    // **Un fallo aquí no puede tumbar el correo.** La presentación es material de apoyo; el
    // paquete del día es lo urgente. Es al revés que la puerta de salud, que sí detiene
    // todo, y el contraste es el motivo: si perder la presentación fuera un error, un 500
    // de esa ruta dejaría sin publicar un día entero de planes.
    process.env.PROMO_CON_PRESENTACION = "1";
    fetchSpy.mockImplementation((async (u: string) => {
      pedidas.push(String(u));
      if (u.includes("/api/promo?")) {
        return { ok: true, status: 200, json: async () => paqueteDePrueba };
      }
      if (u.includes("/api/promo/presentacion")) {
        return { ok: false, status: 500, arrayBuffer: async () => new ArrayBuffer(0) };
      }
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => new Uint8Array([137, 80, 78, 71]).buffer,
      };
    }) as unknown as typeof fetch);

    await cargarScript()();

    expect(sendMail).toHaveBeenCalledTimes(1);
    const opciones = sendMail.mock.calls[0][0] as {
      attachments: Array<{ filename: string }>;
    };
    expect(opciones.attachments.some((a) => a.filename === "presentacion.png")).toBe(false);
    // Y sigue llevando las imágenes del carrusel, que es lo que no puede perderse.
    expect(opciones.attachments.filter((a) => a.filename === "01-portada.png").length).toBe(2);
    expect(process.exitCode).toBeUndefined();
  });
});

describe("la puerta del mínimo", () => {
    it("con dos planes escribe los ficheros, no manda correo y sale con 1", async () => {
      // Aquí sí se escribe: el paquete existe y solo es fino, y quien lo encuentre en el
      // disco decide si lo publica.
      //
      // **El mínimo se cuenta sobre las imágenes del paquete y no sobre una lista local.**
      // Antes venía de `lista.length`, que el script montaba por su cuenta; ahora el
      // paquete es lo que dice cuántos planes hay, que es lo que el sitio va a pintar. Un
      // mínimo medido sobre otra lista volvería a ser una segunda verdad.
      paqueteDePrueba.imagenes = paqueteDePrueba.imagenes.slice(0, 2);
      paqueteDePrueba.titulos = paqueteDePrueba.titulos.slice(0, 2);

      await cargarScript()();

      expect(existsSync(dirEsperado)).toBe(true);
      expect(sendMail).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
    });
  });
});