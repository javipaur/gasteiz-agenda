import { CULTURE_SOURCES, CULTURE_SOURCE_LABELS, CULTURE_SOURCE_PILLS } from "@/lib/cultura";

describe("cultura source mapping", () => {
  it("cada fuente emitida por fetchCultura tiene pill y label", () => {
    const pillKeys = CULTURE_SOURCE_PILLS.conciertos.map((p) => p.key);
    for (const source of CULTURE_SOURCES) {
      expect(pillKeys).toContain(source);
      expect(CULTURE_SOURCE_LABELS[source]).toBeTruthy();
    }
  });

  it("la clave antigua lagenterula no existe", () => {
    expect(CULTURE_SOURCE_LABELS.lagenterula).toBeUndefined();
  });
});