import { tituloCancelado } from "@/lib/cancelaciones";

describe("tituloCancelado", () => {
  it("reconoce los tres títulos que avisan así en la agenda real", () => {
    // Copiados tal cual de producción el 23 de octubre de 2026. Son los cuatro
    // eventos medidos (el del Palacio de Villa Suso se repite dos días).
    expect(tituloCancelado("Visita guiada: Palacio de Villa Suso. Cancelada")).toBe(true);
    expect(tituloCancelado("Visita guiada: Palacio de Villa Suso CANCELADA")).toBe(true);
    expect(tituloCancelado("(cancelado) Ankhara + Ekyrian + Delenda Est")).toBe(true);
  });

  it("no depende de mayúsculas ni de que la palabra cierre el título", () => {
    expect(tituloCancelado("Cancelado")).toBe(true);
    expect(tituloCancelado("CANCELADA")).toBe(true);
    expect(tituloCancelado("Cancelada la obra, se devuelve el importe")).toBe(true);
    expect(tituloCancelado("cancelados")).toBe(true);
  });

  it("no se lleva por delante palabras que solo empiezan igual", () => {
    // `\b` al final es lo que separa "cancelado" de "cancelador": sin él, este
    // último entraría y el evento desaparecería de la agenda sin motivo.
    expect(tituloCancelado("El cancelador")).toBe(false);
    expect(tituloCancelado("Cancelación de matrícula")).toBe(false);
    expect(tituloCancelado("Cancelaciones y devoluciones")).toBe(false);
  });

  it("deja pasar los títulos normales", () => {
    expect(tituloCancelado("Teatro da mangiare?")).toBe(false);
    expect(tituloCancelado("Gigante")).toBe(false);
    expect(tituloCancelado("Pintura de miniaturas")).toBe(false);
    expect(tituloCancelado("Canción de cuna")).toBe(false);
    expect(tituloCancelado("")).toBe(false);
  });

  it("incluye el falso positivo que se acepta a cambio de no publicar un anulado", () => {
    // Una obra que se llame así se cae de la agenda. Es el precio de no servir
    // como vigente un evento que no va a celebrarse, y hoy no hay ningún caso.
    expect(tituloCancelado("El concierto cancelado")).toBe(true);
  });

  it("no cubre anulado ni suspendido, porque no hay ningún caso medido", () => {
    // Está escrito en el módulo: el día que aparezca uno se añade con su caso.
    // Este test existe para que el límite sea una decisión y no un olvido.
    expect(tituloCancelado("Concierto anulado")).toBe(false);
    expect(tituloCancelado("Visita suspendida")).toBe(false);
  });
});
