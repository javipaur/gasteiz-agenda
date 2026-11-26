import { existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

/**
 * `ImageResponse` es perezoso y usa un `import()` dinámico que Jest no puede
 * resolver en CJS. Se sustituye por un PNG real del tamaño pedido: el test lee
 * el cuerpo y comprueba la firma y las dimensiones, que es justo lo que una
 * comprobación de cabeceras deja pasar. El JSX se audita por separado con el AST.
 */
jest.mock("next/og", () => ({
  ImageResponse: class extends Response {
    constructor(element: unknown, size: { width: number; height: number }) {
      const capturados = (globalThis as Record<string, unknown>).elementosNavidad as unknown[];
      capturados?.push(element);
      const buffer = (globalThis as Record<string, unknown>).pngNavidad as Buffer;
      super(Uint8Array.from(buffer), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      });
      void size;
    }
  },
}));

const firmaPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const firmaJpeg = Buffer.from([0xff, 0xd8, 0xff]);

async function leerCuerpo(respuesta: Response): Promise<Buffer> {
  return Buffer.from(await respuesta.arrayBuffer());
}

function importarRuta(ruta: string) {
  return import(join(process.cwd(), "app", "api", "promo", "navidad-vitoria", ruta, "route"));
}

describe("rutas de difusión de Navidad 2026", () => {
  beforeAll(async () => {
    (globalThis as Record<string, unknown>).pngNavidad = await sharp({
      create: { width: 1080, height: 1350, channels: 3, background: "#faf9f5" },
    })
      .png()
      .toBuffer();
  });

  // Cada caso empieza con el registro vacío: si se acumulara, la diapositiva 1
  // heredaría las dos imágenes de la portada y el recuento no mediría nada.
  beforeEach(() => {
    (globalThis as Record<string, unknown>).elementosNavidad = [];
  });

  it("sirve la portada como PNG de 1080×1350 y lee el cuerpo hasta el final", async () => {
    const { GET } = await importarRuta("portada");
    const respuesta = await GET(new Request("http://localhost/api/promo/navidad-vitoria/portada"));
    expect(respuesta.status).toBe(200);
    const cuerpo = await leerCuerpo(respuesta);
    expect(cuerpo.subarray(0, 8)).toEqual(firmaPng);
    expect(cuerpo.readUInt32BE(16)).toBe(1080);
    expect(cuerpo.readUInt32BE(20)).toEqual(1350);
  });

  it("convierte la portada a JPEG sin perder el cuerpo", async () => {
    const { GET } = await importarRuta("portada");
    const respuesta = await GET(
      new Request("http://localhost/api/promo/navidad-vitoria/portada?format=jpeg"),
    );
    expect(respuesta.headers.get("content-type")).toContain("image/jpeg");
    const cuerpo = await leerCuerpo(respuesta);
    expect(cuerpo.subarray(0, 3)).toEqual(firmaJpeg);
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8])(
    "sirve la diapositiva %i como PNG de 1080×1350",
    async (numero) => {
      const { GET } = await importarRuta("diapositiva/[numero]");
      const respuesta = await GET(
        new Request(`http://localhost/api/promo/navidad-vitoria/diapositiva/${numero}`),
        { params: Promise.resolve({ numero: String(numero) }) },
      );
      expect(respuesta.status).toBe(200);
      const cuerpo = await leerCuerpo(respuesta);
      expect(cuerpo.subarray(0, 8)).toEqual(firmaPng);
      expect(cuerpo.readUInt32BE(16)).toBe(1080);
      expect(cuerpo.readUInt32BE(20)).toBe(1350);
      // Una diapositiva produce una sola imagen. El registro se vacía en cada
      // caso: contar hasta `numero` mediría el orden de los tests, no la ruta.
      expect((globalThis as Record<string, unknown>).elementosNavidad).toHaveLength(1);
    },
  );

  it.each([0, 9, -1, "abc"])("rechaza la diapositiva %s", async (numero) => {
    const { GET } = await importarRuta("diapositiva/[numero]");
    const respuesta = await GET(
      new Request(`http://localhost/api/promo/navidad-vitoria/diapositiva/${numero}`),
      { params: Promise.resolve({ numero: String(numero) }) },
    );
    expect(respuesta.status).toBe(404);
  });

  it("el paquete cierra las claves y apunta a las diez piezas", async () => {
    const { GET } = await importarRuta("paquete");
    const datos = await (await GET(new Request("http://localhost/api/promo/navidad-vitoria/paquete"))).json();
    expect(Object.keys(datos).sort()).toEqual(["aviso", "campana", "consultado", "piezas"].sort());
    expect(datos.consultado).toBe("2026-11-26");
    expect(datos.piezas).toHaveLength(10);
    for (const pieza of datos.piezas) {
      expect(Object.keys(pieza).sort()).toEqual(["archivo", "tamano", "url"].sort());
      expect(pieza.url).toMatch(/^\/api\/promo\/navidad-vitoria\//);
    }
    expect(datos.piezas[0].archivo).toBe("portada-navidad-2026.jpg");
    expect(datos.piezas[9].archivo).toBe("reel-navidad-2026.mp4");
  });

  it("sirve el reel como MP4 con su firma y tipo", async () => {
    const ruta = join(process.cwd(), "public", "navidad-2026", "reel.mp4");
    expect(existsSync(ruta)).toBe(true);
    const { GET } = await importarRuta("reel");
    const respuesta = await GET(new Request("http://localhost/api/promo/navidad-vitoria/reel"));
    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get("content-type")).toBe("video/mp4");
    const cuerpo = await leerCuerpo(respuesta);
    expect(cuerpo.subarray(4, 8).toString()).toBe("ftyp");
  });
});
