import { SOURCE_REGISTRY, CULTURE_SOURCE_IDS, SOURCE_LABELS } from "@/lib/source-registry";
import { CATEGORY_COLORS } from "@/lib/categories";

describe("SOURCE_REGISTRY", () => {
  it("tiene identificadores únicos", () => {
    const ids = SOURCE_REGISTRY.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("cada entrada tiene label y run", () => {
    for (const e of SOURCE_REGISTRY) {
      expect(typeof e.label).toBe("string");
      expect(e.label.length).toBeGreaterThan(0);
      expect(typeof e.run).toBe("function");
    }
  });

  it("cada id tiene su label en SOURCE_LABELS", () => {
    for (const e of SOURCE_REGISTRY) {
      expect(SOURCE_LABELS[e.id]).toBe(e.label);
    }
  });

  it("todo category del registro colorea bien", () => {
    for (const e of SOURCE_REGISTRY) {
      if (e.category) {
        expect(CATEGORY_COLORS[e.category]).toBeDefined();
      }
    }
  });

  it("declara exactamente las fuentes de la vista /culture", () => {
    expect([...CULTURE_SOURCE_IDS].sort()).toEqual(
      SOURCE_REGISTRY.filter((e) => e.culture).map((e) => e.id).sort()
    );
  });

  it("cada variante tipada del municipal tiene su propia entrada", () => {
    // No basta con comprobar que group === "municipal": hay que fijar que cada
    // combinacion distinta de argumentos de scrapeMunicipalCalendar tiene
    // entrada propia, porque si dos se fusionaran se perderia su taxonomia.
    const ids = SOURCE_REGISTRY.filter((e) => e.group === "municipal").map((e) => e.id);
    for (const esperado of [
      "municipal-agenda",
      "municipal-teatro",
      "municipal-conciertos",
      "municipal-exposiciones",
      "municipal-general",
      "municipal-deporte",
      "municipal-infantil",
      "municipal-rss",
    ]) {
      expect(ids).toContain(esperado);
    }
  });

  it("el municipal sin filtro va detras de las variantes que llevan taxonomia", () => {
    const prio = (id: string) => SOURCE_REGISTRY.find((e) => e.id === id)!.priority;
    for (const variante of [
      "municipal-agenda",
      "municipal-teatro",
      "municipal-conciertos",
      "municipal-exposiciones",
      "municipal-deporte",
      "municipal-infantil",
    ]) {
      expect(prio(variante)).toBeLessThan(prio("municipal-general"));
    }
  });

  it("las entradas que aportan kind o tags los tienen de verdad", () => {
    for (const conTaxonomia of ["municipal-deporte", "municipal-infantil"]) {
      const e = SOURCE_REGISTRY.find((x) => x.id === conTaxonomia)!;
      expect(e.kind || e.tags).toBeDefined();
    }
  });
});
