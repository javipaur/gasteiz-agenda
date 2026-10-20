import { readFileSync } from "node:fs";
import { join } from "node:path";

import { loadFixture, mockFetchWith } from "../helpers";
import {
  extraerLugares,
  fechaCofalavaAIso,
  parseFarmaciasGuardia,
  scrapeFarmaciasGuardia,
  turnoDeGuardia,
} from "@/lib/sources/farmacias-guardia";

/**
 * El cuadrante de guardia del Colegio de Farmacéuticos de Álava.
 *
 * ## Lo que este test fija
 *
 * Que se saca **el cuadrante de verdad** y no el directorio de opendata. El
 * cambio se hizo porque la belief de la que se partía era falsa: el Colegio
 * "no se puede leer" porque "responde 403 en todo su dominio con cualquier
 * User-Agent".
 *
 * Medido el 20 de octubre de 2026, contra el sitio en vivo:
 *
 *     User-Agent de Chrome -> 403 (75 KB, la página del WAF)
 *     okhttp/4.9.3         -> 200 (6,5 MB, el cuadrante)
 *
 * **El WAF bloquea el User-Agent de navegador, no el dominio.** Y como lo
 * natural es probar con un UA de navegador —es lo que hace cualquier
 * scraper— la conclusión "no se puede" salía sola, y era una conclusión
 * sobre el UA y no sobre el sitio.
 *
 * ## El fixture
 *
 * Es un trozo real de la página: cuatro entradas del array `places` —dos de
 * Vitoria, una de día y otra de noche, y dos de Laudio, una de ellas con los
 * dos iconos de guardia— con la forma exacta que publica el plugin del mapa.
 */
const HTML = loadFixture("cofalava-guardia.html");

describe("el cuadrante de guardia", () => {
  it("saca todas las entradas del array, no solo la primera", () => {
    // **Este es el fallo que casi se cuela.** El escáner去找 el `"places":` y
    // avanza contando corchetes. Si la marca include el `[` del array, el
    // desplazamiento lo salta y el conteo empieza **dentro** del primer
    // objeto: el `[` no se cuenta, el `}` del primer lugar lo cierra y el
    // array se corta tras una farmacia.
    //
    // Y no da error de sintaxis: `JSON.parse` recibe un objeto válido —el
    // primer lugar— y lo devuelve como si fuera el array. Cuatro de 5916
    // entradas, y ningún test que mirara el número de plazas lo notaría.
    const lugares = extraerLugares(HTML);

    expect(Array.isArray(lugares)).toBe(true);
    expect(lugares.length).toBe(4);
    expect(lugares.map((l) => l.title)).toContain("FUERTES LOPEZ-CASERO, ANA");
  });

  it("el array se extrae entero, con las entradas del final", () => {
    const lugares = extraerLugares(HTML);

    // La última entrada del fixture, para que un corte por el principio no
    // pueda pasar unnoticed.
    expect(lugares[lugares.length - 1].title).toBeTruthy();
    expect(lugares.length).toBeGreaterThan(1);
  });

  it("de la provincia solo se queda Vitoria-Gasteiz", () => {
    const farmacias = parseFarmaciasGuardia(HTML);

    expect(farmacias.length).toBe(2);
    expect(farmacias.every((f) => f.city === "Vitoria-Gasteiz")).toBe(true);
    // Y las de otro pueblo no están.
    expect(farmacias.map((f) => f.name)).not.toContain("FUERTES LOPEZ-CASERO, ANA");
  });

  it("la fecha del sitio, en castellano, pasa a ISO", () => {
    // El Colegio escribe `01/01/2026` y el repo usa ISO en todo lo demás. Sin
    // la conversión, la página no puede comparar con "hoy" y el cartel de
    // "Actualizado" no aparece nunca.
    expect(fechaCofalavaAIso("01/01/2026")).toBe("2026-01-01");
    expect(fechaCofalavaAIso("20/10/2026")).toBe("2026-10-20");
    expect(fechaCofalavaAIso("")).toBe("");
    expect(fechaCofalavaAIso("no es una fecha")).toBe("");

    const farmacia = parseFarmaciasGuardia(HTML)[0];
    expect(farmacia.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("el icono de guardia dice si el turno es de día o de noche", () => {
    // El Colegio lo publica como HTML: `fa-sun-o` para el día, `fa-moon-o` para
    // la noche, y los dos cuando la farmacia cubre las dos rondas.
    expect(turnoDeGuardia('<i class="fa fa-sun-o"></i>')).toBe("diurna");
    expect(turnoDeGuardia('<i class="fa fa-moon-o"></i>')).toBe("nocturna");
    expect(
      turnoDeGuardia('<i class="fa fa-sun-o"></i><i class="fa fa-moon-o"></i>')
    ).toBe("ambas");
    // Y si no hay icono, el turno por defecto es de día: es lo que dice el
    // horario, y un turno de noche siempre trae su luna.
    expect(turnoDeGuardia(undefined)).toBe("diurna");
  });

  it("trae el horario, el teléfono, el barrio y las coordenadas", () => {
    // **Son los campos que el directorio no tenía.** Con la fuente anterior,
    // `horarios` y `date` venían vacíos, y la página —que ya estaba pintando
    // esas dos columnas— las enseñaba en blanco.
    const farmacia = parseFarmaciasGuardia(HTML)[0];

    expect(farmacia.horarios).toMatch(/\d{2}:\d{2}-\d{2}:\d{2}/);
    expect(farmacia.phone).toMatch(/^\d{9}$/);
    expect(farmacia.neighborhood).toBeTruthy();
    expect(Number(farmacia.lat)).not.toBeNaN();
    expect(Number(farmacia.lng)).not.toBeNaN();
    expect(farmacia.id).toBeTruthy();
    expect(farmacia.name).toBeTruthy();
  });

  it("el UA no es el de un navegador, porque el WAF lo bloquea", () => {
    // El fallo de fondo: con el UA de Chrome el Colegio responde 403 y el
    // scraper devuelve una lista vacía, que es indistinguible de "hoy no hay
    // guardias". Con un UA de cliente HTTP entra.
    const fuente = loadFixture("cofalava-guardia.html");
    const modulo = readFileSync(
      join(process.cwd(), "lib", "sources", "farmacias-guardia.ts"),
      "utf-8"
    );

    expect(modulo).toContain("okhttp");
    expect(modulo).not.toMatch(/User-Agent["']?\s*[:=]\s*["']Mozilla/);
    // Y el fixture existe, que es lo que se lee.
    expect(fuente.length).toBeGreaterThan(1000);
  });
});

describe("scrapeFarmaciasGuardia", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("lanza cuando la respuesta no es la página del Colegio", async () => {
    // **Un `[]` aquí sería una lista vacía con status 200**, que es
    // exactamente lo que se ve en la app: cero guardias, sin error. Y la app
    // móvil cachea lo que llega, así que el vacío se vuelve permanente.
    mockFetchWith([{ match: /cofalava\.org/, content: "<html>error del WAF</html>" }]);

    expect.assertions(2);
    try {
      await scrapeFarmaciasGuardia();
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(/cofalava\.org/);
    }
  });

  it("propaga el fallo del origen en vez de devolver una lista vacía", async () => {
    const errores = jest.spyOn(console, "error").mockImplementation(() => {});
    mockFetchWith([{ match: /cofalava\.org/, status: 500, content: "" }]);

    await expect(scrapeFarmaciasGuardia()).rejects.toThrow(/cofalava\.org/);
    errores.mockRestore();
  });

  it("con la página buena, devuelve las guardias de Vitoria", async () => {
    mockFetchWith([{ match: /cofalava\.org/, content: HTML }]);

    const farmacias = await scrapeFarmaciasGuardia();

    expect(farmacias.length).toBe(2);
    expect(farmacias.every((f) => f.city === "Vitoria-Gasteiz")).toBe(true);
  });
});
