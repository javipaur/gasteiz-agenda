import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

/**
 * `ImageResponse` es perezoso y no se puede construir dentro de Jest: su
 * implementación usa un `import()` dinámico que el runner de CJS no soporta.
 * Por eso el renderizador se sustituye por una respuesta con un PNG real del
 * tamaño pedido. El test lee el cuerpo y comprueba la firma, que es lo que una
 * comprobación de cabeceras no puede hacer; el JSX que Satori va a renderizar
 * lo audita `__tests__/promo-og-layout.test.ts` con el AST.
 */
jest.mock("next/og", () => ({
  ImageResponse: class extends Response {
    constructor(element: unknown, size: { width: number; height: number }) {
      (globalThis as Record<string, unknown>)[
        size.height === 1350 ? "elementoPost" : "elementoHistoria"
      ] = element;
      const buffer = (globalThis as Record<string, unknown>)[
        size.height === 1350 ? "pngPost" : "pngHistoria"
      ] as Buffer;
      super(Uint8Array.from(buffer), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      });
    }
  },
}));

const firmaPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const firmaJpeg = Buffer.from([0xff, 0xd8, 0xff]);

async function leerCuerpo(respuesta: Response): Promise<Buffer> {
  return Buffer.from(await respuesta.arrayBuffer());
}

function buscarSrcImagen(nodo: unknown): string | null {
  if (Array.isArray(nodo)) {
    for (const hijo of nodo) {
      const encontrado = buscarSrcImagen(hijo);
      if (encontrado !== null) return encontrado;
    }
    return null;
  }
  if (nodo === null || typeof nodo !== "object") return null;
  const elemento = nodo as {
    type?: unknown;
    props?: { children?: unknown; src?: unknown };
  };
  if (elemento.type === "img") {
    return typeof elemento.props?.src === "string" ? elemento.props.src : null;
  }
  return buscarSrcImagen(elemento.props?.children ?? null);
}

async function importarRuta(ruta: string) {
  return await import(join(process.cwd(), "app", "api", "promo", "moradillos-2027", ruta, "route"));
}

describe("rutas de promoción de Moradillos 2027", () => {
  beforeAll(async () => {
    (globalThis as Record<string, unknown>).pngPost = await sharp({
      create: { width: 1080, height: 1350, channels: 3, background: "#faf9f5" },
    })
      .png()
      .toBuffer();
    (globalThis as Record<string, unknown>).pngHistoria = await sharp({
      create: { width: 1080, height: 1920, channels: 3, background: "#faf9f5" },
    })
      .png()
      .toBuffer();
  });

  it("sirve el post como PNG de 1080×1350 y lo lee hasta el final", async () => {
    const { GET } = await importarRuta("post");
    const respuesta = await GET(new Request("http://localhost/api/promo/moradillos-2027/post"));
    expect(respuesta.status).toBe(200);
    const cuerpo = await leerCuerpo(respuesta);
    expect(cuerpo.subarray(0, 8)).toEqual(firmaPng);
    expect(cuerpo.readUInt32BE(16)).toBe(1080);
    expect(cuerpo.readUInt32BE(20)).toBe(1350);
  });

  it("sirve la historia como PNG de 1080×1920", async () => {
    const { GET } = await importarRuta("historia");
    const respuesta = await GET(new Request("http://localhost/api/promo/moradillos-2027/historia"));
    expect(respuesta.status).toBe(200);
    const cuerpo = await leerCuerpo(respuesta);
    expect(cuerpo.subarray(0, 8)).toEqual(firmaPng);
    expect(cuerpo.readUInt32BE(16)).toBe(1080);
    expect(cuerpo.readUInt32BE(20)).toBe(1920);
  });

  it("pinta el cartel real en la historia, sin depender de que producción ya lo sirva", async () => {
    const { GET } = await importarRuta("historia");
    await GET(new Request("http://localhost/api/promo/moradillos-2027/historia"));
    const src = buscarSrcImagen((globalThis as Record<string, unknown>).elementoHistoria);
    expect(src).toMatch(/^data:image\/jpeg;base64,/);
    const cartel = readFileSync(join(process.cwd(), "public", "moradillos-2027", "cartel.jpg"));
    expect(Buffer.from(src!.split(",")[1]!, "base64").equals(cartel)).toBe(true);
  });

  it("convierte el post a JPEG solo cuando se pide, sin perder el cuerpo", async () => {
    const { GET } = await importarRuta("post");
    const respuesta = await GET(new Request("http://localhost/api/promo/moradillos-2027/post?format=jpeg"));
    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get("content-type")).toContain("image/jpeg");
    const cuerpo = await leerCuerpo(respuesta);
    expect(cuerpo.subarray(0, 3)).toEqual(firmaJpeg);
  });

  it("el paquete cierra las claves y apunta a las tres piezas", async () => {
    const { GET } = await importarRuta("paquete");
    const respuesta = await GET(new Request("http://localhost/api/promo/moradillos-2027/paquete"));
    expect(respuesta.status).toBe(200);
    const datos = await respuesta.json();
    expect(Object.keys(datos).sort()).toEqual(["destino", "fechas", "piezas", "sede"].sort());
    expect(datos.destino).toBe("Préjano (La Rioja)");
    expect(datos.fechas).toBe("2 y 3 de julio de 2027");
    expect(datos.sede).toBe("/moradillos-2027");
    expect(datos.piezas).toEqual([
      {
        archivo: "post-moradillos-2027.jpg",
        url: "/api/promo/moradillos-2027/post?format=jpeg",
        tamano: "1080x1350",
      },
      {
        archivo: "historia-moradillos-2027.jpg",
        url: "/api/promo/moradillos-2027/historia?format=jpeg",
        tamano: "1080x1920",
      },
      {
        archivo: "cartel-moradillos-2027.jpg",
        url: "/api/promo/moradillos-2027/cartel",
        tamano: "1600x1600",
      },
    ]);
  });

  it("el tamaño anunciado del cartel es el del fichero que se sirve", async () => {
    const { GET } = await importarRuta("paquete");
    const datos = await (await GET(new Request("http://localhost/api/promo/moradillos-2027/paquete"))).json();
    const cartel = datos.piezas.find((pieza: { archivo: string }) => pieza.archivo === "cartel-moradillos-2027.jpg");
    const metadata = await sharp(join(process.cwd(), "public", "moradillos-2027", "cartel.jpg")).metadata();
    expect(cartel.tamano).toBe(`${metadata.width}x${metadata.height}`);
  });

  it("la ruta del cartel sirve el JPEG original y no una imagen inventada", async () => {
    const { GET } = await importarRuta("cartel");
    const respuesta = await GET(new Request("http://localhost/api/promo/moradillos-2027/cartel"));
    expect(respuesta.status).toBe(200);
    const cuerpo = await leerCuerpo(respuesta);
    expect(cuerpo.subarray(0, 3)).toEqual(firmaJpeg);
    expect(cuerpo.equals(readFileSync(join(process.cwd(), "public", "moradillos-2027", "cartel.jpg")))).toBe(true);
  });
});
