import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  MORADILLOS_2027,
  RUTAS_PROMO_MORADILLOS,
  descripcionMoradillos,
  mostrarEnPortada,
  resumenMoradillos,
  segmentosPublicosDe,
} from "@/lib/moradillos-2027";

const raiz = join(process.cwd(), "public", "moradillos-2027");

/**
 * Estos tests fijan la forma del material de prensa, no la fecha de publicación.
 * La frontera editorial sigue siendo la misma: el repo prepara material, n8n
 * publica y una persona decide.
 */
describe("promoción editorial de Moradillos 2027", () => {
  const archivos = ["cartel.jpg", "logo-principal.png", "foto-directo.jpg", "foto-publico.jpg"];

  it.each(archivos)("mantiene %s en la sala local", (archivo) => {
    const ruta = join(raiz, archivo);
    expect(existsSync(ruta)).toBe(true);
    expect(readFileSync(ruta).length).toBeGreaterThan(1000);
  });

  it("mantiene el cartel y las fotos en JPEG", () => {
    for (const archivo of ["cartel.jpg", "foto-directo.jpg", "foto-publico.jpg"]) {
      expect(readFileSync(join(raiz, archivo)).subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
    }
  });

  it("mantiene el logo principal en PNG, sobre fondo claro", () => {
    expect(readFileSync(join(raiz, "logo-principal.png")).subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  });

  it("mantiene los datos del festival en un solo sitio", () => {
    expect(MORADILLOS_2027.fechas).toBe("2 y 3 de julio de 2027");
    expect(MORADILLOS_2027.destino).toBe("Préjano (La Rioja)");
    expect(MORADILLOS_2027.carteles).toContain("Izaro");
    expect(MORADILLOS_2027.carteles).toContain("Ezezez");
  });

  it("mantiene el bloque hasta el 31 de julio, en hora de Madrid", () => {
    // 23:59 del 31 de julio en Préjano ya es el 1 de agosto en UTC. Comparar
    // con `getUTCMonth()` sacaba el bloque doce horas antes de lo previsto.
    expect(mostrarEnPortada(new Date("2027-07-31T21:59:00Z"))).toBe(true);
    expect(mostrarEnPortada(new Date("2027-07-31T22:59:00Z"))).toBe(false);
  });

  it("deriva la prosa y la metadata de los datos del festival", () => {
    expect(descripcionMoradillos()).toContain(MORADILLOS_2027.titulo);
    expect(descripcionMoradillos()).toContain(MORADILLOS_2027.fechas);
    expect(descripcionMoradillos()).toContain(MORADILLOS_2027.destino);
    expect(resumenMoradillos()).toContain(MORADILLOS_2027.carteles);
    expect(resumenMoradillos()).toContain(MORADILLOS_2027.generos);
  });

  it("no repite los datos editoriales en la ficha", () => {
    const pagina = readFileSync(join(process.cwd(), "app", "moradillos-2027", "page.tsx"), "utf8");
    for (const literal of [
      "2 y 3 de julio",
      "Izaro",
      "Ezezez",
      "rock, psicodelia y blues",
      "Moradillos Fest 2027",
    ]) {
      expect({ literal, repetido: pagina.includes(literal) }).toEqual({
        literal,
        repetido: false,
      });
    }
  });

  it("saca las tres rutas del paquete del módulo de datos", () => {
    expect(RUTAS_PROMO_MORADILLOS).toEqual({
      post: "/api/promo/moradillos-2027/post?format=jpeg",
      historia: "/api/promo/moradillos-2027/historia?format=jpeg",
      cartel: "/api/promo/moradillos-2027/cartel",
    });
    const paquete = readFileSync(
      join(process.cwd(), "app", "api", "promo", "moradillos-2027", "paquete", "route.ts"),
      "utf8",
    );
    expect(paquete).not.toContain('"/api/promo/moradillos-2027/');
  });

  it("lee el cartel desde la ruta declarada, no desde un nombre suelto", () => {
    expect(segmentosPublicosDe(MORADILLOS_2027.imagenes.cartel)).toEqual([
      "moradillos-2027",
      "cartel.jpg",
    ]);
    for (const ruta of ["historia/route.tsx", "cartel/route.ts"]) {
      const codigo = readFileSync(
        join(process.cwd(), "app", "api", "promo", "moradillos-2027", ruta),
        "utf8",
      );
      expect({ ruta, suelto: codigo.includes('"cartel.jpg"') }).toEqual({
        ruta,
        suelto: false,
      });
    }
  });
});
