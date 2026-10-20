import {
  normalizeCategory,
  mapToCultureCategory,
  CULTURA_CATEGORIAS,
  CATEGORY_COLORS,
  CATEGORY_FILLS,
} from "@/lib/categories";

describe("normalizeCategory", () => {
  it("returns 'Otros' for empty or undefined categories", () => {
    expect(normalizeCategory()).toBe("Otros");
    expect(normalizeCategory("")).toBe("Otros");
    expect(normalizeCategory(undefined)).toBe("Otros");
  });

  it("normalizes aliases to canonical categories", () => {
    expect(normalizeCategory("conciertos")).toBe("Música");
    expect(normalizeCategory("musica")).toBe("Música");
    expect(normalizeCategory("música")).toBe("Música");
    expect(normalizeCategory("teatro")).toBe("Teatro");
    expect(normalizeCategory("exposiciones")).toBe("Exposiciones");
    expect(normalizeCategory("niños")).toBe("Infantil");
    expect(normalizeCategory("charla")).toBe("Conferencias");
    expect(normalizeCategory("excursiones")).toBe("Senderismo");
  });

  it("ignores accents when normalizing", () => {
    expect(normalizeCategory("Exposición")).toBe("Exposiciones");
    expect(normalizeCategory("Gastronomía")).toBe("Gastronomía");
  });

  it("keeps unknown categories as-is", () => {
    expect(normalizeCategory("RetroGaming")).toBe("RetroGaming");
  });

  /**
   * Los seis vocabularios que se colaban, con el número de eventos medido en la
   * respuesta en vivo del 5 de octubre de 2026 y de qué fuente salía cada uno.
   *
   * Estos tests existen porque **no hay ningún fixture que pueda hacerlo**. Se
   * comprobó: ninguna de las 25 fixture trae estas palabras como *valor* de
   * categoría, solo como texto libre dentro de descripciones —`rula-response.json`
   * contiene "otro" 21 veces y ni una es una categoría—. Así que el guard de
   * `__tests__/sources/euskadi.test.ts` no podía verlas: su fixture son 20 ítems
   * de 311, página 1 de 16, y solo cubre cinco tipos.
   *
   * Lo que se fija aquí es la **traducción**, con la fuente escrita al lado para
   * que el día que una fuente cambie de vocabulario se sepa a cuál de estos
   *vocabularios se refiere. No es un test que afloje: si alguien borra un alias,
   * cae en `Otros` o se cuela sin color, y esto se pone rojo.
   *
   * Y es un test de las claves, no de las etiquetas: cada valor entra por la misma
   * ruta que un `typeEs` de Euskadi o un `tipo` de MEC —minúsculas, sin tilde, con
   * `trim`—, que es por donde llegaron.
   */
  const VOCABULARIOS_MEDIDOS: ReadonlyArray<
    [crudo: string, destino: string, fuente: string]
  > = [
    // 20 eventos. Euskadi manda esto cuando no reconoce el tipo, y los títulos sí
    // concretan (5 visitas guiadas, 3 talleres familiares, un festival de teatro,
    // cinco de la Feria del Libro), pero la clasificación no se inventa aquí: es de
    // quien publica, y el aggregate no es quien decide qué es un festival.
    ["otro", "Otros", "euskadi"],
    // 20 eventos, 17 de los 20 empiezan por "Taller:". Los otros tres son dos
    // PHOTOBOOK y un "Iniciación al Handpan en familia", que también es taller.
    ["formación", "Talleres", "euskadi"],
    // 12 eventos del RSS municipal: "Quedada Street HIIT", "Quedada Taichi",
    // "Rutas en la naturaleza +55". Sin esto no entraban en `/deporte`, que filtra
    // por `kind` y esta entrada del registro no declara ninguno.
    ["deportiva", "Deporte", "municipal-rss"],
    // 35 eventos de La Genterula, que agrupa teatro y danza en un solo tipo. Se
    // Traduce a Teatro: de los 35, unos 26 lo son y unos 6 son danza, que pierden
    // su categoría propia. Es el coste de unificar en un lado u otro, y al revés
    // perdería 26. No hay forma de partirlo sin adivinar por el título.
    ["Teatro y danza", "Teatro", "rula"],
    // 2 poetry jams. "Literatura" no está en la taxonomía y no se añade aquí: una
    // categoría nueva necesita su color, su peso y su página, y son 2 eventos.
    ["Literatura", "Otros", "rula"],
    // 1 evento, el programa de la Feria del Libro. Mismo caso.
    ["feria", "Otros", "euskadi"],
  ];

  it.each(VOCABULARIOS_MEDIDOS)(
    '"%s" (de %s) se traduce a "%s" y gana color',
    (crudo, destino, _fuente) => {
      expect(normalizeCategory(crudo)).toBe(destino);
      expect(CATEGORY_COLORS[normalizeCategory(crudo)]).toBeDefined();
      expect(normalizeCategory(crudo)).not.toBe(crudo);
    }
  );

  it("cada vocabulario medido tiene ya su alias, sin depender del texto libre de los fixtures", () => {
    // El punto del test anterior, por si alguien lo debilita a una comprobación de
    // que "no sea vacío". La razón de que sobre: ninguna fixture trae estas
    // palabras como categoría, y un test que las buscara en ellas pasaría con
    // cero translated.
    for (const [crudo] of VOCABULARIOS_MEDIDOS) {
      expect(normalizeCategory(crudo.toUpperCase())).toBe(normalizeCategory(crudo));
    }
  });
});

describe("mapToCultureCategory", () => {
  it("maps known categories to culture slugs", () => {
    expect(mapToCultureCategory("Teatro")).toBe("teatro");
    expect(mapToCultureCategory("Música")).toBe("conciertos");
    expect(mapToCultureCategory("conciertos")).toBe("conciertos");
    expect(mapToCultureCategory("Exposiciones")).toBe("exposiciones");
  });

  it("falls back to 'agenda' for unknown categories", () => {
    expect(mapToCultureCategory("Deporte")).toBe("agenda");
    expect(mapToCultureCategory("")).toBe("agenda");
  });
});

describe("CULTURA_CATEGORIAS", () => {
  it("exports the four culture category slugs", () => {
    const slugs = CULTURA_CATEGORIAS.map((c) => c.slug);
    expect(slugs).toEqual(["teatro", "conciertos", "exposiciones", "agenda"]);
  });
});

describe("CATEGORY_COLORS", () => {
  it("has a color for every canonical category", () => {
    expect(CATEGORY_COLORS["Música"]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(CATEGORY_COLORS["Teatro"]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(CATEGORY_COLORS["Cine"]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(CATEGORY_COLORS["Otros"]).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("uses the deep editorial palette", () => {
    // Los valores concretos son una decisión de marca y por eso se fijan: un
    // rebrand accidental se ve aquí.
    expect(CATEGORY_COLORS["Música"]).toBe("#B3203F");
    expect(CATEGORY_COLORS["Teatro"]).toBe("#1E4A8A");
    expect(CATEGORY_COLORS["Cine"]).toBe("#4A3B6E");
    expect(CATEGORY_COLORS["Deporte"]).toBe("#1F6E6A");
    expect(CATEGORY_COLORS["Otros"]).toBe("#6B675C");
  });
});

/**
 * El contraste de los rellenos de categoría.
 *
 * No es un eco de constante: es la **propiedad** que hay que uphold. Un relleno
 * de categoría se pinta de blanco por encima —la píldora de la tarjeta, la banda
 * del filtro, la tarjeta grande de la portada— y un color que pase con blanco
 * pero no con la tinta oscura rompe la otra mitad del contrato.
 *
 * Antes el test solo miraba el hex, así que un color ilegible era indistinguible
 * de uno correcto. Esto mide la cifra, que es lo que no se ve leyendo la clase.
 */
function luminancia(hex: string): number {
  const n = parseInt(hex.replace("#", ""), 16);
  const canales = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * canales[0] + 0.7152 * canales[1] + 0.0722 * canales[2];
}

function ratio(primero: string, segundo: string): number {
  const a = luminancia(primero);
  const b = luminancia(segundo);
  const [claro, oscuro] = a > b ? [a, b] : [b, a];
  return (claro + 0.05) / (oscuro + 0.05);
}

describe("los rellenos de categoría", () => {
  it("todos pasan AA con el texto blanco que va encima", () => {
    const entradas = Object.entries(CATEGORY_FILLS);
    expect(entradas.length).toBeGreaterThan(10);
    for (const [categoria, color] of entradas) {
      const r = ratio(color, "#FFFFFF");
      if (r < 4.5) {
        throw new Error(
          `${categoria} (${color}) con texto blanco da ${r.toFixed(2)}:1 y AA pide 4.5:1`
        );
      }
    }
  });

  it("CATEGORY_COLORS y CATEGORY_FILLS llevan la misma paleta", () => {
    /*
     * Son dos mapas y ahora tienen los mismos valores, y eso es a propósito.
     *
     * La diferencia era "píldora clara con tinta oscura" y "relleno hondo con
     * texto blanco". Con la paleta nueva la regla es otra —**texto claro sobre
     * relleno saturado**, que es lo que hace la referencia— y entonces los dos
     * mapas llevan lo mismo y la tinta de la píldora pasa a ser blanca.
     *
     * Se fija aquí para que nadie los separe otra vez por costumbre y rompa el
     * contraste sin enterarse: si divergen, la píldora queda con tinta blanca
     * sobre un color claro y no se lee.
     */
    expect(CATEGORY_COLORS).toEqual(CATEGORY_FILLS);
  });
});