import { blancaEditionYear } from "@/lib/blanca";

/**
 * El año de la edición de La Blanca sale de las fechas que devuelve el calendario
 * municipal, no del reloj ni de una constante.
 *
 * Con el año cableado en el código, el día que se celebrated la edición siguiente
 * el scraper seguía pidiendo el rango de julio y agosto del año anterior, que ya
 * no devuelve nada: la sección de La Blanca se vacía sola en agosto y nadie se
 * entera hasta que se nota. Estos tests fijan que el año viene de los datos.
 */
describe("blancaEditionYear", () => {
  it("toma el año de la fecha más temprana", () => {
    // La identidad de una edición es cuándo empieza, no la última que aparece.
    expect(blancaEditionYear(["2027-08-09", "2027-07-15", "2027-07-25"])).toBe(2027);
  });

  it("ordena las fechas en vez de confiar en el orden del array", () => {
    expect(blancaEditionYear(["2028-07-20", "2027-07-15"])).toBe(2027);
  });

  it("devuelve null si no hay ninguna fecha utilizable", () => {
    expect(blancaEditionYear([])).toBeNull();
    expect(blancaEditionYear(["", "sin-fecha"])).toBeNull();
  });

  it("ignora las fechas que no son YYYY-MM-DD", () => {
    // `date` viene de `parseDate`, que devuelve "" para una `fechaInicio` que no
    // son ocho dígitos. Una entrada vacía no puede inventarse como año 1.
    expect(blancaEditionYear(["", "2027-07-25", "2027-07-26"])).toBe(2027);
  });

  it("acepta también fechas con hora, que es lo que emite el calendario", () => {
    expect(blancaEditionYear(["2027-07-25T05:30Z"])).toBe(2027);
  });
});