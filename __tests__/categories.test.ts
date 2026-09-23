import {
  normalizeCategory,
  mapToCultureCategory,
  CULTURA_CATEGORIAS,
  CATEGORY_COLORS,
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

  it("uses the saturated fever palette", () => {
    expect(CATEGORY_COLORS["Música"]).toBe("#FF4D7D");
    expect(CATEGORY_COLORS["Teatro"]).toBe("#7B4DFF");
    expect(CATEGORY_COLORS["Cine"]).toBe("#FFB300");
    expect(CATEGORY_COLORS["Deporte"]).toBe("#9BFF57");
    expect(CATEGORY_COLORS["Otros"]).toBe("#7C8794");
  });
});