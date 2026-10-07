import { TAMANO_PROMO, urlDePromo, radioImagenPromo, textoDelPie } from "@/lib/promo";

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

describe("el pie de foto", () => {
  const ev = (title: string, location = "") => ({ title, location });

  it("con tres planes los lista y cuenta", () => {
    const texto = textoDelPie(
      [ev("Concierto en el Joyel", "Sala Ganueta"), ev("Cine", "Florida"), ev("Mercado", "")],
      "2026-10-07",
      "2026-10-07"
    );

    expect(texto).toContain("HOY");
    expect(texto).toContain("3 planes");
    expect(texto).toContain("• Concierto en el Joyel — Sala Ganueta");
  });

  it("uno solo en singular, que «1 planes» delata el generador", () => {
    expect(textoDelPie([ev("Uno")], "2026-10-07", "2026-10-07")).toContain("1 plan");
  });

  it("un día sin nada lo dice sin fingir que hay algo", () => {
    // La tentación aquí es rellenarlo. Un post que dice "hoy no hay nada" y aun así
    // lleva a la agenda es más útil que uno que inventa tres planes para no quedar
    // en blanco.
    const texto = textoDelPie([], "2026-10-07", "2026-10-07");

    expect(texto).toContain("HOY");
    expect(texto).toContain("no hay nada recomendado");
  });

  it("la ventana larga no dice HOY", () => {
    const texto = textoDelPie([ev("Uno")], "2026-10-10", "2026-10-11");

    expect(texto).toContain("ESTE FINDE");
    expect(texto).not.toContain("HOY");
  });
});