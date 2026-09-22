import { getQueVer, getRutasTurismo, getInfoPractica } from "@/lib/turismo";

const REQUIRED = ["slug", "nombre", "descripcion"] as const;

describe("turismo curado", () => {
  it("qué ver: invariantes de estructura", async () => {
    const items = await getQueVer();
    expect(items.length).toBeGreaterThanOrEqual(5);
    for (const item of items) {
      for (const k of REQUIRED) expect(item[k]).toBeTruthy();
      if (item.coords) {
        expect(typeof item.coords.lat).toBe("number");
        expect(typeof item.coords.lng).toBe("number");
      }
      if (item.linkMaps) expect(item.linkMaps).toMatch(/^https:\/\//);
      if (item.slug) expect(item.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("rutas: invariantes de estructura", async () => {
    const rutas = await getRutasTurismo();
    expect(rutas.length).toBeGreaterThanOrEqual(2);
    for (const r of rutas) {
      expect(["Baja", "Media", "Alta"]).toContain(r.dificultad);
      expect(r.duracion).toBeTruthy();
      expect(r.puntoSalida).toBeTruthy();
    }
  });

  it("info práctica: tiene intro y bloques", async () => {
    const info = await getInfoPractica();
    expect(info.intro).toBeTruthy();
    expect(info.bloques.length).toBeGreaterThanOrEqual(3);
    for (const b of info.bloques) {
      expect(b.titulo).toBeTruthy();
      expect(b.items.length).toBeGreaterThan(0);
    }
  });
});