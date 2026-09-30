import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { SOURCE_DATA, SOURCE_LABELS, sourceGroup } from "@/lib/source-data";
import { SOURCE_REGISTRY } from "@/lib/source-registry";

const ROOT = resolve(__dirname, "..");

/** Resuelve un especificador de import a fichero, o `null` si es un paquete. */
function resolveSpecifier(fromFile: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(ROOT, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(fromFile), spec);
  else return null;
  for (const suffix of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const candidate = base + suffix;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/**
 * Especificadores que un fichero importa de verdad. Los `import type` se
 * ignoran a propósito: TypeScript los borra al compilar, así que no pueden
 * arrastrar nada al bundle. Los `export ... from` cuentan, que también emiten
 * código.
 */
function importSpecifiers(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const specs: string[] = [];
  const re = /(?:^|\n)\s*(?:import|export)\s+(type\s+)?[^;]*?from\s+["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    if (!match[1]) specs.push(match[2]);
  }
  const bare = /(?:^|\n)\s*import\s+["']([^"']+)["']/g;
  while ((match = bare.exec(source)) !== null) specs.push(match[1]);
  return specs;
}

/** Ficheros de `lib/sources/` alcanzables desde `roots` por imports estáticos. */
function scrapersReachableFrom(roots: string[]): string[] {
  const seen = new Set<string>();
  const scrapers = new Set<string>();
  const queue = [...roots];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of importSpecifiers(file)) {
      const target = resolveSpecifier(file, spec);
      if (!target) continue;
      if (relative(ROOT, target).replace(/\\/g, "/").startsWith("lib/sources/")) {
        scrapers.add(relative(ROOT, target).replace(/\\/g, "/"));
      } else {
        queue.push(target);
      }
    }
  }
  return [...scrapers].sort();
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if ([".next", ".git", "node_modules"].includes(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.tsx?$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

/** Todos los módulos marcados `"use client"`, que es la raíz del grafo cliente. */
function clientModules(): string[] {
  return [...walk(join(ROOT, "app")), ...walk(join(ROOT, "lib"))].filter(
    (file) => readFileSync(file, "utf8").startsWith('"use client"')
  );
}

describe("frontera entre el registro y el cliente", () => {
  it("el módulo de datos no importa ningún scraper", () => {
    expect(importSpecifiers(join(ROOT, "lib", "source-data.ts"))).toEqual([]);
  });

  it("lib/utils.ts y lib/tickets.ts no alcanzan ningún scraper", () => {
    // Estos dos los cargan los componentes cliente: `sourceLabel` desde
    // `lib/shared.tsx` e `isTicketSource` desde las tarjetas y el detalle.
    for (const mod of ["lib/utils.ts", "lib/tickets.ts"]) {
      expect({ mod, scrapers: scrapersReachableFrom([join(ROOT, mod)]) }).toEqual({
        mod,
        scrapers: [],
      });
    }
  });

  it("ningún componente cliente alcanza un scraper", () => {
    // El fallo que se está evitando: `lib/shared.tsx` es "use client" y fue a
    // través de `lib/utils.ts` al registro compuesto, llevándose los 18 scrapers
    // al bundle (chunk de la home de 146 KB a 403 KB). Este test es el que lo
    // vuelve a detectar si alguien vuelve a colgar el registro compuesto de un
    // módulo cliente, con el nombre del culpable en el mensaje.
    const culpables: string[] = [];
    for (const file of clientModules()) {
      const scrapers = scrapersReachableFrom([file]);
      if (scrapers.length > 0) {
        culpables.push(`${relative(ROOT, file)} -> ${scrapers.join(", ")}`);
      }
    }
    expect(culpables).toEqual([]);
  });
});

describe("composición del registro", () => {
  it("no hay ids repetidos en los datos", () => {
    // `SOURCE_LABELS` y `SOURCE_GROUPS` se construyen con `Object.fromEntries`, así
    // que un id repetido colapsa en silencio: la entrada desaparece de los mapas
    // mientras `SOURCE_REGISTRY` sigue teniendo las 27. El test de paridad de
    // abajo no lo pilla, porque compara el array consigo mismo.
    expect(new Set(SOURCE_DATA.map((e) => e.id)).size).toBe(SOURCE_DATA.length);
  });

  it("toda entrada de datos tiene su función de scraping", () => {
    // Si faltara alguna, `SOURCE_REGISTRY` habría reventado al construirse, así
    // que además de comparar esto comprobamos que el registro tiene tantas
    // entradas como datos, sin duplicados ni huecos.
    expect(SOURCE_REGISTRY.map((e) => e.id)).toEqual(SOURCE_DATA.map((e) => e.id));
    for (const entry of SOURCE_REGISTRY) {
      expect(typeof entry.run).toBe("function");
    }
  });

  it("los mapas del registro salen de los datos y no al revés", () => {
    expect(SOURCE_LABELS).toEqual(
      Object.fromEntries(SOURCE_REGISTRY.map((e) => [e.id, e.label]))
    );
    for (const entry of SOURCE_REGISTRY) {
      expect({ id: entry.id, group: sourceGroup(entry) }).toEqual({
        id: entry.id,
        group: entry.group ?? entry.id,
      });
    }
  });
});
