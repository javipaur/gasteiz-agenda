/**
 * @jest-environment jsdom
 */

/**
 * Los siete `loading.tsx` son esqueletos puramente visuales: cajas con
 * `animate-pulse` y nada más. Sin `role="status"`, sin `aria-busy` y sin texto,
 * cambiar de ruta es un silencio para quien usa lector de pantalla: no hay nada
 * que anunciar ni nada que le diga que la página está llegando.
 */
import { escenario } from "../helpers-a11y";

type Modulo = { default: () => unknown };

const RUTAS: [string, string][] = [
  ["home", "@/app/loading"],
  ["cultura", "@/app/culture/loading"],
  ["deporte", "@/app/deporte/loading"],
  ["cine", "@/app/movies/loading"],
  ["familia", "@/app/kids/loading"],
  ["conciertos", "@/app/conciertos/loading"],
  ["favoritos", "@/app/favoritos/loading"],
];

describe("estados de carga", () => {
  it.each(RUTAS)("%s anuncia que está cargando", (_nombre, ruta) => {
    const { crear, montar, modulo } = escenario<Modulo>(ruta);
    const vista = montar(crear(modulo.default, {}));

    const estado = vista.consultar('[role="status"]');
    expect(estado).not.toBeNull();
    expect(estado!.getAttribute("aria-busy")).toBe("true");
    // El texto va en `sr-only`: los esqueletos son cajas vacías y no tienen texto
    // visible que anuncie nada.
    expect(estado!.querySelector(".sr-only")!.textContent).toContain("Cargando");

    vista.desmontar();
  });

  it("cultura y deporte anuncian los dos", () => {
    // Los dos ficheros son copia el uno del otro (solo cambia el nombre del
    // componente), así que si uno se arregla y el otro no, el mismo fallo vive en
    // dos sitios y ya no se distingue del original. La palabra concreta puede
    // cambiar: lo que no puede es que uno anuncie y el otro no.
    const cultura = escenario<Modulo>("@/app/culture/loading");
    const deporte = escenario<Modulo>("@/app/deporte/loading");

    const vCultura = cultura.montar(cultura.crear(cultura.modulo.default, {}));
    const vDeporte = deporte.montar(deporte.crear(deporte.modulo.default, {}));

    const anuncio = (estado: HTMLElement) => ({
      role: estado.getAttribute("role"),
      busy: estado.getAttribute("aria-busy"),
      texto: estado.querySelector(".sr-only")!.textContent,
    });

    expect(anuncio(vCultura.consultar('[role="status"]')!)).toEqual({
      role: "status",
      busy: "true",
      texto: "Cargando la agenda cultural…",
    });
    expect(anuncio(vDeporte.consultar('[role="status"]')!)).toEqual({
      role: "status",
      busy: "true",
      texto: "Cargando la agenda deportiva…",
    });

    vCultura.desmontar();
    vDeporte.desmontar();
  });
});