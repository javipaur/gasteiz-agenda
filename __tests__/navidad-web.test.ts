import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * La integración de Navidad en la portada se comprueba en el código, no pintando
 * la home: `app/page.tsx` tiene catorce `Suspense` y arrastra todos los scrapers,
 * y un test de render se pondría rojo por un color antes de llegar a la pregunta.
 *
 * Lo que importa aquí es una regla de composición: **la ventana se decide en el
 * servidor y el cliente solo recibe el resultado**. Si el hero empezara a llamar a
 * `navidadDelDia()` por su cuenta, tendríamos dos relojes y dos husos para la
 * misma lista, que es exactamente el fallo que `HeroSection` ya evita con el prop
 * `ahora`.
 */
function pagina(): string {
  return readFileSync(join(process.cwd(), "app", "page.tsx"), "utf8");
}

function hero(): string {
  return readFileSync(join(process.cwd(), "app", "components", "HeroSection.tsx"), "utf8");
}

describe("la Navidad en la portada", () => {
  it("la ventana se calcula en el servidor y el resultado llega al hero como prop", () => {
    const src = pagina();

    expect(src).toMatch(/navidadDelDia\(/);
    expect(src).toMatch(/<HeroSection[\s\S]*?navidad=/);
  });

  it("el hero no decide qué día es: solo pinta lo que le pasan", () => {
    const src = hero();

    expect(src).toMatch(/navidad\?:/);
    expect(src).not.toMatch(/navidadDelDia|NAVIDAD_2026/);
    expect(src).toMatch(/Navidad 2026/);
  });
});
