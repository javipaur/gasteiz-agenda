import { TAMANO_PROMO, urlDePromo, radioImagenPromo } from "@/lib/promo";

describe("el paquete de redes", () => {
  it("las tarjetas son 4:5, que es lo que ocupa más pantalla en el feed", () => {
    // El número va escrito porque su valor es el de avisar: si mañana alguien
    // cambia el tamaño a 1080×1080 por lo que sea, este test pregunta por qué.
    expect(TAMANO_PROMO).toEqual({ width: 1080, height: 1350 });
  });

  it("las URLs del paquete son absolutas y del sitio desplegado", () => {
    // Instagram necesita una URL que pueda descargar sin autenticación. Una URL
    // relativa no vale, y una de localhost menos.
    expect(urlDePromo("2026-10-07")).toBe(
      "https://gasteizclick.javierpalacio.es/api/promo/2026-10-07/portada"
    );
    expect(urlDePromo("2026-10-07", "concierto-de-prueba")).toBe(
      "https://gasteizclick.javierpalacio.es/api/promo/2026-10-07/evento/concierto-de-prueba"
    );
  });

  it("solo usa imágenes de hosts que el sitio sabe servir", () => {
    // Un host fuera de la lista deja un rectángulo vacío en el post, y desde fuera no
    // hay forma de saber por qué.
    expect(radioImagenPromo("https://www.vitoria-gasteiz.org/cartel.jpg")).toBe(
      "https://www.vitoria-gasteiz.org/cartel.jpg"
    );
    expect(radioImagenPromo("/logo.svg")).toBe("/logo.svg");
    expect(radioImagenPromo("https://cdn.desconocido.example/c.jpg")).toBeNull();
    expect(radioImagenPromo(null)).toBeNull();
    expect(radioImagenPromo(undefined)).toBeNull();
    expect(radioImagenPromo("")).toBeNull();
  });
});