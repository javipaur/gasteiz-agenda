import sharp from "sharp";

import { paraInstagramJpeg } from "@/lib/promo-image";

describe("formato de imagen para Instagram", () => {
  async function pngDePrueba(): Promise<Buffer> {
    return sharp({
      create: {
        width: 2,
        height: 2,
        channels: 3,
        background: { r: 220, g: 38, b: 38 },
      },
    })
      .png()
      .toBuffer();
  }

  it("convierte a JPEG solo cuando se solicita y conserva las cabeceras de caché", async () => {
    const request = new Request("https://example.test/api/promo?format=jpeg");
    const image = new Response(Uint8Array.from(await pngDePrueba()), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, s-maxage=1800",
      },
    });

    const response = await paraInstagramJpeg(request, image);
    const bytes = Buffer.from(await response.arrayBuffer());

    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(response.headers.get("Cache-Control")).toBe("public, s-maxage=1800");
    expect(response.headers.has("Content-Length")).toBe(false);
    expect(bytes.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    await expect(sharp(bytes).metadata()).resolves.toMatchObject({ format: "jpeg" });
  });

  it("mantiene la respuesta PNG existente cuando no se solicita JPEG", async () => {
    const image = new Response(Uint8Array.from(await pngDePrueba()), {
      headers: { "Content-Type": "image/png" },
    });

    const response = await paraInstagramJpeg(
      new Request("https://example.test/api/promo"),
      image
    );

    expect(response).toBe(image);
    expect(response.headers.get("Content-Type")).toBe("image/png");
  });

  it("no intenta convertir una respuesta de error", async () => {
    const error = new Response("no encontrado", { status: 404 });

    const response = await paraInstagramJpeg(
      new Request("https://example.test/api/promo?format=jpeg"),
      error
    );

    expect(response).toBe(error);
    expect(await response.text()).toBe("no encontrado");
  });
});
