import { test, expect } from "@playwright/test";
import sharp from "sharp";

/**
 * Los tests de Jest sustituyen `ImageResponse` por un señuelo: su
 * implementación usa un `import()` dinámico que el runner de CJS no soporta.
 * Eso deja una pregunta sin responder —¿renderiza Satori de verdad?— y ya
 * hubo un fallo en este repo donde la imagen se cortaba a mitad del stream y
 * el test de cabeceras seguía en verde.
 *
 * Aquí se pide la ruta por HTTP y se lee el cuerpo. La firma y las dimensiones
 * se comprueban con `sharp`, no con el `content-type`: una respuesta rota
 * también puede traer las cabeceras correctas.
 */

const RAIZ = "/api/promo/moradillos-2027";

for (const caso of [
  { nombre: "post", ruta: `${RAIZ}/post`, ancho: 1080, alto: 1350 },
  { nombre: "historia", ruta: `${RAIZ}/historia`, ancho: 1080, alto: 1920 },
]) {
  for (const formato of ["png", "jpeg"] as const) {
    test(`${caso.nombre} renderiza ${formato} con su tamaño`, async ({ request }) => {
      const res = await request.get(`${caso.ruta}?format=${formato}`, {
        timeout: 120_000,
      });
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toContain(
        formato === "png" ? "image/png" : "image/jpeg",
      );

      const bytes = await res.body();
      const imagen = sharp(bytes);
      const metadata = await imagen.metadata();
      expect(bytes.subarray(0, 4).toString("hex")).toMatch(
        formato === "png" ? /^89504e47/ : /^ffd8ff/,
      );
      expect(metadata.width).toBe(caso.ancho);
      expect(metadata.height).toBe(caso.alto);
    });
  }
}

test("el cartel se sirve tal cual, sin volver a dibujarlo", async ({ request }) => {
  const res = await request.get(`${RAIZ}/cartel`, { timeout: 60_000 });
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("image/jpeg");

  const bytes = await res.body();
  const metadata = await sharp(bytes).metadata();
  expect(bytes.subarray(0, 3).toString("hex")).toMatch(/^ffd8ff/);
  expect(metadata.width).toBe(1600);
  expect(metadata.height).toBe(1600);
});

test("el paquete solo anuncia piezas que responden", async ({ request }) => {
  const res = await request.get(`${RAIZ}/paquete`, { timeout: 60_000 });
  expect(res.status()).toBe(200);

  const paquete = await res.json();
  expect(paquete.piezas).toHaveLength(3);
  for (const pieza of paquete.piezas) {
    const piezaRes = await request.get(pieza.url, { timeout: 120_000 });
    expect({ url: pieza.url, status: piezaRes.status() }).toEqual({
      url: pieza.url,
      status: 200,
    });
    expect(piezaRes.headers()["content-type"]).toMatch(/^image\/(jpeg|png)/);
    expect((await piezaRes.body()).length).toBeGreaterThan(1000);
  }
});
