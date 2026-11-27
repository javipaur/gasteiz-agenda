import { TituloPromo, tamanoTituloPromo } from "@/lib/promo-titulo";

/**
 * El carrusel del 27 de noviembre de 2026 enseñó este título partido en la mitad de la
 * frase: `Presentación de la exposición fotográfica: "Casco Viejo - Las personas que
 * habitamos el barrio,…`. El dato venía completo del Ayuntamiento y la diapositiva lo
 * recortaba a 96 caracteres. La imagen no daba ningún error: un título cortado sigue
 * siendo un título.
 *
 * El arreglo no puede ser "subir el límite" porque un día llega uno más largo. Lo que se
 * prueba aquí son las dos mitades: el texto pintado es el original, y la letra baja
 * cuando el texto crece para que quepa en el marco.
 */
const TITULO_LARGO =
  'Presentación de la exposición fotográfica: "Casco Viejo - Las personas que habitamos el barrio, los hilos que conforman nuestro paño"';

describe("título de una diapositiva del carrusel", () => {
  it("pinta el título completo aunque tenga 133 caracteres", () => {
    const elemento = TituloPromo({ titulo: TITULO_LARGO });

    expect(elemento.props.children).toBe(TITULO_LARGO);
  });

  it("baja la letra para que un título largo quepa en el marco", () => {
    expect(tamanoTituloPromo("Cobardes")).toBe(52);
    expect(tamanoTituloPromo(TITULO_LARGO)).toBeLessThanOrEqual(34);
    expect(tamanoTituloPromo("x".repeat(200))).toBeLessThanOrEqual(34);
  });

  it("no deja un título corto con una letra más pequeña de la prevista", () => {
    const elemento = TituloPromo({ titulo: "Cobardes" });

    expect(elemento.props.style).toMatchObject({
      display: "flex",
      fontSize: 52,
      lineHeight: 1.1,
    });
  });
});
