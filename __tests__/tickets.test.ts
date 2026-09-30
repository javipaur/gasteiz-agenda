import { TICKET_SOURCES, isTicketSource } from "@/lib/tickets";
import { SOURCE_REGISTRY } from "@/lib/source-registry";

describe("isTicketSource", () => {
  it("cubre solo fuentes que venden entradas de verdad", () => {
    // Salas con venta directa y plataformas de venta. No es "todo lo que hay en
    // el registro": el Ayuntamiento no vende entradas y una fuente que solo
    // agrega no las vende por sí misma.
    expect([...TICKET_SOURCES].sort()).toEqual([
      "entradium",
      "eventbrite",
      "fever",
      "helldorado",
      "jimmyjazz",
      "musikaze",
      "vam",
      "vam-conciertos",
    ]);
  });

  it("ningún id con CTA está muerto", () => {
    // El conjunto se deriva del registro, así que no puede quedar colgando un id
    // renombrado: si el registro cambia, esto se cae solo.
    const ids = new Set(SOURCE_REGISTRY.map((e) => e.id));
    for (const id of TICKET_SOURCES) {
      expect(ids).toContain(id);
    }
  });

  it("no da CTA a las fuentes que no venden", () => {
    for (const id of [
      "municipal-agenda",
      "municipal-conciertos",
      "municipal-general",
      "municipal-visitas",
      "municipal-infantil",
      "buscametas-calendario",
      "fiestas-blanca",
      "arkabia",
      "gasteizhoy",
      "rula",
      "euskadi",
      "vital",
      "miniature",
    ]) {
      expect(isTicketSource(id)).toBe(false);
    }
  });

  it("mantiene la firma: un valor ausente no es fuente de entradas", () => {
    expect(isTicketSource(undefined)).toBe(false);
    expect(isTicketSource("")).toBe(false);
  });
});
