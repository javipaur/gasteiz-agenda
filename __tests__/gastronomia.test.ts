import {
  getSitios,
  getRutasPintxos,
  getEnsaladillaCampeonato,
  estadoEnsaladilla,
  totalBaresEnsaladilla,
} from "@/lib/gastronomia";

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

  it("campeonato de la ensaladilla: 40 bares en 7 zonas con datos completos", async () => {
    const campeonato = await getEnsaladillaCampeonato();
    expect(campeonato).not.toBeNull();
    if (!campeonato) return;

    expect(campeonato.nombre).toContain("Campeonato de la Ensaladilla");
    expect(campeonato.fechas.inicio).toBe("2026-11-19");
    expect(campeonato.fechas.fin).toBe("2026-11-29");
    expect(campeonato.final.fecha).toBe("2026-11-30");
    expect(campeonato.fuente.url).toContain("gasteizhoy.com");
    expect(campeonato.zonas).toHaveLength(7);

    const total = totalBaresEnsaladilla(campeonato);
    expect(total).toBe(40);
    for (const zona of campeonato.zonas) {
      expect(zona.nombre).toBeTruthy();
      expect(zona.bares.length).toBeGreaterThanOrEqual(2);
      for (const bar of zona.bares) {
        expect(bar.nombre).toBeTruthy();
        expect(bar.propuesta).toBeTruthy();
      }
    }
  });

  it("campeonato de la ensaladilla: estado según fecha", async () => {
    const campeonato = await getEnsaladillaCampeonato();
    expect(campeonato).not.toBeNull();
    if (!campeonato) return;

    expect(estadoEnsaladilla(campeonato, new Date("2026-11-18T12:00:00"))).toBe("proximo");
    expect(estadoEnsaladilla(campeonato, new Date("2026-11-19T12:00:00"))).toBe("en-marcha");
    expect(estadoEnsaladilla(campeonato, new Date("2026-11-29T12:00:00"))).toBe("en-marcha");
    expect(estadoEnsaladilla(campeonato, new Date("2026-11-30T12:00:00"))).toBe("finalizado");
  });
});