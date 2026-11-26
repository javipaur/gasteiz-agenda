import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  AVISO_CAMBIOS,
  NAVIDAD_2026,
  POR_CONFIRMAR,
  eventosNavidadComoAgenda,
 navidadEnVentana,
  recomendadosNavidad,
} from "@/lib/navidad-vitoria";

/**
 * Los datos de Navidad se consultan el 26 de noviembre de 2026. Un test que
 * leyera las fuentes por red sería intermitente y además convertiría el
 * repositorio en un cliente de los sitios que describe; lo que se fija aquí es
 * que lo que ya se consultó esté completo, fechado y sin inventos.
 */
describe("datos verificados de Navidad 2026 en Vitoria-Gasteiz", () => {
  it("guarda la fecha de consulta en cada fuente", () => {
    expect(NAVIDAD_2026.consultado).toBe("2026-11-26");
    for (const evento of NAVIDAD_2026.eventos) {
      for (const fuente of evento.fuentes) {
        expect(fuente.url).toMatch(/^https:\/\//);
        expect(fuente.consultado).toBe("2026-11-26");
        expect(fuente.titulo.length).toBeGreaterThan(3);
      }
    }
  });

  it("todo evento trae fecha, lugar, precio y fuente", () => {
    for (const evento of NAVIDAD_2026.eventos) {
      expect(evento.id).toMatch(/^[a-z0-9-]+$/);
      expect(evento.titulo.length).toBeGreaterThan(3);
      expect(
        evento.fecha === POR_CONFIRMAR || /^\d{4}-\d{2}-\d{2}$/.test(evento.fecha),
      ).toBe(true);
      if (evento.fechaFin) expect(evento.fechaFin).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(evento.lugar.length).toBeGreaterThan(3);
      expect(["Gratis", "Donativo", POR_CONFIRMAR]).toContain(evento.precio);
      expect(evento.fuentes.length).toBeGreaterThan(0);
    }
  });

  it("los ids son únicos", () => {
    const ids = NAVIDAD_2026.eventos.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("lo que no está confirmado se dice, y no se rellena con datos de otro año", () => {
    const dudosos = NAVIDAD_2026.eventos.filter((e) => e.estado === "por-confirmar");
    expect(dudosos.length).toBeGreaterThan(0);
    for (const evento of dudosos) {
      const blob = [evento.hora, evento.lugar, evento.precio].join(" ");
      expect(blob).toContain(POR_CONFIRMAR);
    }
    const carmen = NAVIDAD_2026.eventos.find((e) => e.id === "belenes-carmen");
    expect(carmen?.hora).toBe(POR_CONFIRMAR);
    expect(carmen?.fecha).toBe(POR_CONFIRMAR);
    expect(carmen?.nota).toContain("2025");
  });

  it("las discrepancias entre fuentes oficiales se escriben, no se esconden", () => {
    expect(NAVIDAD_2026.eventos.find((e) => e.id === "belen-monumental")?.nota).toContain("10:00");
    expect(NAVIDAD_2026.eventos.find((e) => e.id === "horra")?.nota).toContain("10:00");
  });

  it("la ruta del carrusel tiene ocho pasos, ordenados y existentes", () => {
    expect(NAVIDAD_2026.diapositivas).toHaveLength(8);
    const ids = new Set(NAVIDAD_2026.eventos.map((e) => e.id));
    for (const [i, diapositiva] of NAVIDAD_2026.diapositivas.entries()) {
      expect(diapositiva.numero).toBe(i + 1);
      expect(ids.has(diapositiva.evento)).toBe(true);
      expect(diapositiva.fuente.length).toBeGreaterThan(3);
    }
    expect(new Set(NAVIDAD_2026.diapositivas.map((d) => d.evento)).size).toBe(8);
  });

  it("cada diapositiva lleva el aviso de cambiar la fuente oficial", () => {
    expect(AVISO_CAMBIOS).toBe("Consulta cambios en la web oficial");
    for (const diapositiva of NAVIDAD_2026.diapositivas) {
      expect(diapositiva.aviso).toBe(AVISO_CAMBIOS);
    }
  });

  it("la ventana se decide en Europe/Madrid, no en UTC", () => {
    // 23:30 del 6 de enero en Madrid ya es el 7 en UTC. Con UTC la Navidad
    // se apagara seis horas antes de que acabe el día de Reyes.
    expect(navidadEnVentana(new Date("2026-11-25T22:30:00Z"))).toBe(false);
    expect(navidadEnVentana(new Date("2026-11-25T23:30:00Z"))).toBe(true);
    expect(navidadEnVentana(new Date("2027-01-06T22:30:00Z"))).toBe(true);
    expect(navidadEnVentana(new Date("2027-01-06T23:30:00Z"))).toBe(false);
  });

  it("los eventos con fecha pasan a la forma de la agenda sin perder el enlace", () => {
    const agenda = eventosNavidadComoAgenda();
    const conFecha = NAVIDAD_2026.eventos.filter((e) => e.fecha !== POR_CONFIRMAR);
    expect(agenda).toHaveLength(conFecha.length);
    expect(agenda.some((e) => e.title.includes("Carmen"))).toBe(false);
    for (const evento of agenda) {
      expect(evento.id).toBe(evento.slug);
      expect(evento.link).toMatch(/^https:\/\//);
      expect(evento.title.length).toBeGreaterThan(3);
    }
  });

  it("el orden recomendado sale de recomendados(), no de una lista escrita a mano", () => {
    const ahora = new Date("2026-11-26T18:00:00Z");
    const candidatos = eventosNavidadComoAgenda();
    const ordenados = recomendadosNavidad(ahora);
    expect(ordenados.length).toBe(candidatos.length);
    const titulos = new Set(candidatos.map((e) => e.title));
    for (const evento of ordenados) expect(titulos.has(evento.title)).toBe(true);
    expect(ordenados[0]?.title).toBeTruthy();
  });

  it("los academicos de las rutas no repiten los datos del módulo", () => {
    const ficheros = [
      "app/api/promo/navidad-vitoria/paquete/route.ts",
      "app/api/promo/navidad-vitoria/portada/route.tsx",
      "app/api/promo/navidad-vitoria/diapositiva/[numero]/route.tsx",
    ];
    const literales = ["Plaza de España", "17:30", "Parque de La Florida", "1.100 elementos"];
    for (const fichero of ficheros) {
      const codigo = readFileSync(join(process.cwd(), fichero), "utf8");
      for (const literal of literales) {
        expect({ fichero, literal, repetido: codigo.includes(literal) }).toEqual({
          fichero,
          literal,
          repetido: false,
        });
      }
    }
  });

  it("el guion del reel existe y manda añadir la musica fuera del MP4", () => {
    const guion = readFileSync(
      join(process.cwd(), "docs", "navidad-2026-guion-reel.md"),
      "utf8",
    );
    expect(guion).toContain("0:00");
    expect(guion).toContain("120 bpm");
    expect(guion).toMatch(/m[uú]sica/i);
    expect(guion).toContain("npm run reel:navidad");
  });
});
