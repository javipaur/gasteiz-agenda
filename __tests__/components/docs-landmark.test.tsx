/**
 * @jest-environment jsdom
 */

/**
 * `app/docs/page.tsx` abría un `<main>` dentro del `<main id="main-content">` de
 * `app/layout.tsx`. Dos landmarks `main` en el mismo documento: el lector ofrece
 * dos "contenido principal" y el enlace "Saltar al contenido principal" del layout
 * sigue apuntando al de fuera, que ya no es el único.
 */
import { escenario } from "../helpers-a11y";

describe("/docs", () => {
  it("no añade un segundo landmark main dentro del del layout", () => {
    const { crear, montar, modulo } = escenario<{ default: () => unknown }>(
      "@/app/docs/page"
    );

    // Montar la página dentro del `<main>` del layout es el documento real: si
    // `/docs` añade otro, aquí hay dos.
    const vista = montar(
      crear("main", {
        id: "main-content",
        children: crear(modulo.default, {}),
      })
    );

    const mains = document.querySelectorAll("main");
    expect(mains).toHaveLength(1);
    expect(mains[0].id).toBe("main-content");

    vista.desmontar();
  });
});