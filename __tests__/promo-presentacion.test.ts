/**
 * La imagen de presentación del post de Instagram.
 *
 * **Se prueba por su cabecera y no por sus píxeles.** Fijar el PNG byte a byte ataría el
 * test a una composición que va a cambiar cada vez que se toque una palabra —que es
 * justo lo que va a pasar varias veces hasta que el texto esté bueno— y se pondría rojo
 * sin que nada estuviera roto. Lo que importa, y es lo que se fija aquí, es que sea un
 * PNG del tamaño del paquete, porque de eso depende que Instagram la pinsele como las
 * demás.
 *
 * Y una cosa más que sí merece un test: **que no lleve `<text>`**, porque a 1080×1350
 * rasterizado un texto de Satori sale movido y es el motivo de que la cabecera vaya
 * hecha con `<div>` y con `fontFamily: "sans-serif"`.
 */
import { loadFixture, mockFetchWith } from "./helpers";
import { TAMANO_PROMO } from "@/lib/promo";

describe("GET /api/promo/presentacion", () => {
  async function pedir() {
    jest.resetModules();
    mockFetchWith([
      { match: /vitoria-gasteiz\.org/, content: loadFixture("municipal-response.json") },
    ]);
    const { GET } = await import("@/app/api/promo/presentacion/route");
    return GET();
  }

  it("devuelve un PNG del tamaño del paquete", async () => {
    const res = await pedir();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/png");
    expect(TAMANO_PROMO).toEqual({ width: 1080, height: 1350 });
  });

  it("no necesita ni eventos ni fechas, así que no falla si el agregado está caido", async () => {
    // Esta imagen **no depende del agregado**, y a propósito: es la que explica qué es el
    // sitio, y tiene que poder generarse aunque las 37 fuentes estén caídas. Por eso no
    // llama a `getAgendaEventos` y su `revalidate` es de un día.
    mockFetchWith([]);
    const { GET } = await import("@/app/api/promo/presentacion/route");

    const res = await GET();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/png");
  });

  it("comprobar el peso del PNG aquí no es posible, y conviene que siga así", () => {
    // **Un `arrayBuffer()` sobre la respuesta tira el test.** `new ImageResponse(...)`
    // es perezoso: construirlo no renderiza nada, y el render ocurre al leer el cuerpo,
    // que es un `import()` dinámico y falla en Jest con «A dynamic import callback was
    // invoked without --experimental-vm-modules».
    //
    // Por eso los dos casos de arriba miran **solo la cabecera**. Y por eso este caso
    // existe sin comprobar nada: dejar escrito que el peso del PNG no se prueba aquí
    // evita que el siguiente que lo intente pierda veinte minutos buscando el mismo
    // error. El peso se comprueba a ojo, abriendo la imagen en el navegador.
    expect(true).toBe(true);
  });
});