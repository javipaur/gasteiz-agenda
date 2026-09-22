import { getSitios, getRutasPintxos } from "@/lib/gastronomia";

describe("gastronomía curada", () => {
  it("sitios: invariantes de estructura", async () => {
    const sitios = await getSitios();
    expect(sitios.length).toBeGreaterThanOrEqual(6);
    for (const s of sitios) {
      expect(s.nombre).toBeTruthy();
      expect(s.barrio).toBeTruthy();
      expect(["€", "€€", "€€€"]).toContain(s.rangoPrecio);
      expect(s.direccion).toBeTruthy();
      if (s.coords) {
        expect(typeof s.coords.lat).toBe("number");
        expect(typeof s.coords.lng).toBe("number");
      }
      expect(s.slug).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("rutas de pintxos: al menos 3 zonas con paradas", async () => {
    const rutas = await getRutasPintxos();
    expect(rutas.length).toBeGreaterThanOrEqual(3);
    for (const r of rutas) {
      expect(r.nombre).toBeTruthy();
      expect(r.zona).toBeTruthy();
      expect(r.paradas.length).toBeGreaterThanOrEqual(3);
      for (const p of r.paradas) expect(p.pintxo).toBeTruthy();
    }
  });
});