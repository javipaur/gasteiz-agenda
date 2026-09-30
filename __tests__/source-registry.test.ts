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

  it("cada variante municipal comparte group", () => {
    const municipales = SOURCE_REGISTRY.filter((e) => e.group === "municipal");
    expect(municipales.length).toBeGreaterThan(1);
    for (const m of municipales) expect(m.group).toBe("municipal");
  });
});
