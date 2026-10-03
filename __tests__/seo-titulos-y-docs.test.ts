import { readFileSync, existsSync, globSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * `<title>` con la marca duplicada, y `/docs` indexable.
 *
 * Lo de los `<title>` es un error de plantilla: `app/layout.tsx` declara
 * `template: "%s | Gasteiz Click"`, así que una página que ya escribe la marca en
 * su `title` produce "Conciertos en Vitoria-Gasteiz · Gasteiz Click | Gasteiz
 * Click". Sale en el `<title>`, en la pestaña y en el resultado de búsqueda, y
 * un snapshot de la página entera no lo detecta porque sólo cambia el head.
 *
 * Lo de `/docs` tiene dos mitades y **una no basta**. `robots.txt` compara por
 * prefijo: `Disallow: /docs/` no casa con la URL `/docs`, que es la que existe,
 * porque la barra final es parte del prefijo. Y aunque la línea fuese correcta,
 * `robots.txt` es una pista, no una orden: por eso la página además tiene que
 * declarar `robots: { index: false }`, que es lo que sí emite la etiqueta y lo
 * que respetan los buscadores de verdad.
 */

const ROOT = resolve(__dirname, "..");

const LAYOUT = readFileSync(join(ROOT, "app", "layout.tsx"), "utf8");
const ROBOTS = readFileSync(join(ROOT, "app", "robots.ts"), "utf8");

/** Extrae el `title` de un fichero, sea `metadata` o `generateMetadata`. */
function titleDe(fuente: string): string | null {
  const m = fuente.match(/\btitle:\s*["'`]([^"'`]+)["'`]/);
  return m ? m[1] : null;
}

/** Rutas de página de la App Router, incluidas las anidadas. */
function paginas(): string[] {
  return globSync(join(ROOT, "app", "**", "page.tsx"))
    .map((f) => f.slice(ROOT.length + 1).replace(/\\/g, "/"))
    .sort();
}

describe("título de las páginas", () => {
  it("el layout pone una plantilla con la marca", () => {
    // Sin esta plantilla, repetir la marca en el título de una página sería
    // correcto, y el test de abajo daría rojo sin motivo.
    expect(LAYOUT).toMatch(/template:\s*["'`]%s \| Gasteiz Click["'`]/);
  });

  it.each(paginas())("%s no repite la marca que ya pone la plantilla", (fichero) => {
    const title = titleDe(readFileSync(join(ROOT, fichero), "utf8"));
    if (title === null) return; // página sin `title` propio: usa el `default`
    expect({
      fichero,
      title,
      motivo: "la plantilla del layout ya añade la marca",
    }).toEqual({
      fichero,
      title: expect.not.stringContaining("Gasteiz Click"),
      motivo: expect.any(String),
    });
  });
});

describe("/docs no se indexa", () => {
  it("robots.txt prohíbe la ruta sin barra final", () => {
    // La comparación es por prefijo y la barra final **es** parte del prefijo:
    // `Disallow: /docs/` deja pasar `/docs`. Y `Disallow: /docs` ya cubre
    // también `/docs/loquesea`, así que sobra la variante con barra.
    const bloque = ROBOTS.match(/disallow:\s*\[([^\]]*)\]/)?.[1] ?? "";
    const entradas = [...bloque.matchAll(/["']([^"']+)["']/g)].map((m) => m[1]);
    expect({ entradas, cubreDocs: entradas.includes("/docs") }).toEqual({
      entradas: expect.arrayContaining(["/api/", "/docs"]),
      cubreDocs: true,
    });
  });

  it("la página de docs se declara de cliente, así que el indexado va en su layout", () => {
    // No es un detalle de estilo: `app/docs/page.tsx` tiene `"use client"` porque
    // carga Swagger por CDN. Un componente de cliente **no puede** exportar
    // `metadata`, así que la única forma de emitir la etiqueta es un
    // `layout.tsx` al lado. Sin este test, el próximo que quite el `"use client"`
    // —o que lo mueva— se queda sin `index: false` y no ve por qué.
    const pagina = readFileSync(join(ROOT, "app", "docs", "page.tsx"), "utf8");
    expect(pagina).toMatch(/^\s*["']use client["']/);
    expect(pagina).not.toMatch(/\bexport const metadata\b/);

    const layout = join(ROOT, "app", "docs", "layout.tsx");
    expect({
      existe: existsSync(layout),
      declaraNoIndex: existsSync(layout)
        ? /index:\s*false/.test(readFileSync(layout, "utf8"))
        : false,
    }).toEqual({ existe: true, declaraNoIndex: true });
  });

  it("ninguna otra página de cliente intenta exportar metadata", () => {
    // Es el modo de fallo equivalente del punto anterior, comprobado en todos los
    // sitios a la vez: Next avisa de esto en el build, pero en `dev` pasa
    // desapercibido y el `robots` simplemente no se emite.
    const infractores = paginas()
      .map((f) => [f, readFileSync(join(ROOT, f), "utf8")] as const)
      .filter(([, fuente]) => /^\s*["']use client["']/.test(fuente) && /\bexport const metadata\b/.test(fuente))
      .map(([f]) => f);
    expect(infractores).toEqual([]);
  });
});
