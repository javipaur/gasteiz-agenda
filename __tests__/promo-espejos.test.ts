import sharp from "sharp";

import {
  convertirImagenPromo,
  crearBuscadorDeEspejos,
  crearResolutorDeImagenPromo,
} from "@/lib/promo-espejos";

const MUNICIPAL =
  "https://www.vitoria-gasteiz.org/docs/wb021/img/gestor/30/95/gi_93095.jpg";
const ESPEJO =
  "https://www.gasteizhoy.com/wp-content/uploads/2026/11/gi_93095.webp";
const FECHA = "2026-11-26";
const BASE_ESPEJO = "https://www.gasteizhoy.com/wp-content/uploads";
const JPEG_EN_LINEA = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==";

/** La respuesta real de una foto: 200, sin `content-type` y con `content-length`. */
function respuestaImagen(): Response {
  return new Response(null, {
    status: 200,
    headers: { "content-length": "6888" },
  });
}

/** La respuesta real de un fichero que no existe: 302 a la portada. */
function respuestaPortada(): Response {
  return new Response(null, {
    status: 302,
    headers: { location: "/", "content-type": "text/html; charset=UTF-8" },
  });
}

describe("el espejo de una foto municipal que no carga", () => {
  it("sirve la copia del otro medio en vez de la URL del host caído", async () => {
    // El 26 de noviembre de 2026 nueve diapositivas traían una URL del Ayuntamiento
    // que agotaba el timeout: Satori pintaba el rectángulo de reserva y Graph rechazaba
    // el carrusel con 9004. La copia es la misma foto con otro host.
    const resolver = crearResolutorDeImagenPromo(
      async () => ESPEJO,
      async () => JPEG_EN_LINEA,
    );

    expect(await resolver(MUNICIPAL, FECHA)).toBe(JPEG_EN_LINEA);
  });

  it("sin copia deja la tarjeta sin foto, no la URL que no carga", async () => {
    // `gi_94488` no tiene copia. Devolver la municipal habría sido volver al fallo:
    // diez segundos de espera y un rectángulo que parece una imagen.
    const resolver = crearResolutorDeImagenPromo(
      async () => null,
      async () => JPEG_EN_LINEA,
    );

    expect(await resolver(MUNICIPAL, FECHA)).toBeNull();
  });

  it("una foto de otro host no se busca y sigue su camino", async () => {
    const buscar = jest.fn(async () => ESPEJO);
    const convertir = jest.fn(async () => JPEG_EN_LINEA);
    const resolver = crearResolutorDeImagenPromo(buscar, convertir);
    const directa = "https://opendata.euskadi.eus/cartel.jpg";

    expect(await resolver(directa, FECHA)).toBe(directa);
    expect(buscar).not.toHaveBeenCalled();
    expect(convertir).not.toHaveBeenCalled();
  });

  it("dos diapositivas con el mismo id comparten una sola búsqueda", async () => {
    // Las diez tarjetas se piden a la vez desde el workflow. Sin caché, diez peticiones
    // al otro medio por la misma foto, y una caída del espejo se multiplica por diez.
    const buscar = jest.fn(async () => ESPEJO);
    const convertir = jest.fn(async () => JPEG_EN_LINEA);
    const resolver = crearResolutorDeImagenPromo(buscar, convertir);
    const otraRuta =
      "https://www.vitoria-gasteiz.org/docs/wb021/img/gestor/otro/gi_93095.png";

    expect(
      await Promise.all([
        resolver(MUNICIPAL, FECHA),
        resolver(otraRuta, FECHA),
      ]),
    ).toEqual([JPEG_EN_LINEA, JPEG_EN_LINEA]);
    expect(buscar).toHaveBeenCalledTimes(1);
    expect(convertir).toHaveBeenCalledTimes(1);
  });

  it("un fallo del espejo no tumba la tarjeta", async () => {
    // Un error del otro medio no puede convertir una tarjeta en un 502:
    // la marca de reserva es una imagen honesta y el workflow la deja pasar.
    const resolver = crearResolutorDeImagenPromo(
      async () => {
        throw new Error("espejo caído");
      },
      async () => JPEG_EN_LINEA,
    );

    expect(await resolver(MUNICIPAL, FECHA)).toBeNull();
  });

  it("pasa la fecha del evento al buscador", async () => {
    // Sin la fecha no se sabe en qué directorio del otro medio está la copia.
    const buscar = jest.fn(async () => ESPEJO);
    const resolver = crearResolutorDeImagenPromo(
      buscar,
      async () => JPEG_EN_LINEA,
    );

    await resolver(MUNICIPAL, FECHA);

    expect(buscar).toHaveBeenCalledWith("gi_93095", FECHA);
  });
});

describe("la copia se entrega en un formato que el renderizador sabe pintar", () => {
  it("convierte el webp del espejo a JPEG en línea antes de dárselo a Satori", async () => {
    // Medido el 26 de noviembre de 2026: el espejo sirve solo `.webp`, y el
    // renderizador de `ImageResponse` lanza «Unsupported image type: image/webp»,
    // calla el error y pinta el rectángulo de reserva. La URL rápida no basta: sin
    // convertir, la foto sigue sin verse en el post.
    const webp = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "#b70011" },
    })
      .webp()
      .toBuffer();
    const fetchImpl = jest.fn(async () => new Response(new Uint8Array(webp)));
    const convertir = await convertirImagenPromo(
      ESPEJO,
      fetchImpl as unknown as typeof fetch,
    );

    expect(convertir).toMatch(/^data:image\/jpeg;base64,/);
    if (!convertir) throw new Error("La conversión devolvió null");
    const bytes = Buffer.from(convertir.split(",")[1], "base64");
    expect(bytes.subarray(0, 3).toString("hex")).toBe("ffd8ff");
    expect(fetchImpl).toHaveBeenCalledWith(ESPEJO, expect.any(Object));
  });

  it("una copia que no se puede convertir deja la tarjeta sin foto", async () => {
    // Un espejo que devuelve HTML o corta la conexión no puede convertir en un 502:
    // el hueco honesto vale más que un rectángulo que parece una foto.
    const resolver = crearResolutorDeImagenPromo(
      async () => ESPEJO,
      async () => {
        throw new Error("webp ilegible");
      },
    );

    expect(await resolver(MUNICIPAL, FECHA)).toBeNull();
  });
});

describe("la copia se encuentra sin la búsqueda lenta del WP", () => {
  it("sonda la URL directa del mes del evento antes que la del año anterior", async () => {
    // Medido el 26 de noviembre de 2026: `wp-json/wp/v2/media?search=gi_93095`
    // tarda 16–19 s por id, y la imagen directa 37–188 ms. Diez búsquedas en paralelo
    // agotaban el plazo de descarga de los hijos de Instagram y Graph devolvía 9004.
    const pedidas: string[] = [];
    const fetchImpl = jest.fn(async (url: string | URL | Request) => {
      const destino = String(url);
      pedidas.push(destino);
      return destino.includes("/2026/11/gi_93095.webp")
        ? respuestaImagen()
        : respuestaPortada();
    });
    const buscar = crearBuscadorDeEspejos(fetchImpl as unknown as typeof fetch);

    expect(await buscar("gi_93095", FECHA)).toBe(ESPEJO);
    expect(pedidas).toEqual([`${BASE_ESPEJO}/2026/11/gi_93095.webp`]);
    expect(pedidas.some((u) => u.includes("wp-json"))).toBe(false);
  });

  it("encuentra una copia subida el año anterior, como gi_89795", async () => {
    // La foto del encendido de 2026 se publicó en 2025/11. Sin el mes del año
    // anterior la portada se queda sin foto aunque la copia exista.
    const fetchImpl = jest.fn(async (url: string | URL | Request) =>
      String(url).includes("/2025/11/gi_89795.webp")
        ? respuestaImagen()
        : respuestaPortada(),
    );
    const buscar = crearBuscadorDeEspejos(fetchImpl as unknown as typeof fetch);

    expect(await buscar("gi_89795", FECHA)).toBe(
      `${BASE_ESPEJO}/2025/11/gi_89795.webp`,
    );
  });

  it("una redirección a la portada no se acepta como foto", async () => {
    // Un fichero inexistente responde 302 a `/`. Si se aceptara, Satori descargaría
    // HTML en lugar de una imagen y la tarjeta volvería al rectángulo de reserva.
    const fetchImpl = jest.fn(async () => respuestaPortada());
    const buscar = crearBuscadorDeEspejos(fetchImpl as unknown as typeof fetch);

    expect(await buscar("gi_94488", FECHA)).toBeNull();
  });

  it("sin fecha no se inventa un mes ni se hace una petición", async () => {
    const fetchImpl = jest.fn(async () => respuestaImagen());
    const buscar = crearBuscadorDeEspejos(fetchImpl as unknown as typeof fetch);

    expect(await buscar("gi_93095", null)).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
