import {
  SOURCE_REGISTRY,
  CULTURE_SOURCE_IDS,
  SOURCE_LABELS,
  SOURCE_GROUPS,
} from "@/lib/source-registry";
import { CATEGORY_COLORS } from "@/lib/categories";

// Los ids del municipal se declaran aquí una sola vez para no repetirlos en
// varios tests. El orden importa: el test de inventario compara contra el
// orden del registro.
const IDS_MUNICIPALES = [
  "municipal-agenda",
  "municipal-teatro",
  "municipal-conciertos",
  "municipal-exposiciones",
  "municipal-general",
  "municipal-deporte",
  "municipal-infantil",
  "municipal-visitas",
  "municipal-rss",
] as const;

// Las variantes tipadas: cada una llama a scrapeMunicipalCalendar con una
// combinación de argumentos distinta. Ninguna puede ir por detrás del municipal
// sin filtro, que es un superconjunto de todas ellas. `municipal-visitas` está
// además la última de las de priority 0 por el mismo motivo: si el sitio
// ignorara su `tipo` y devolviera el calendario entero, se comería el `kind` de
// `municipal-deporte` y los `tags` de `municipal-infantil`.
const MUNICIPALES_CON_TAXONOMIA = [
  "municipal-agenda",
  "municipal-teatro",
  "municipal-conciertos",
  "municipal-exposiciones",
  "municipal-deporte",
  "municipal-infantil",
  "municipal-visitas",
] as const;

describe("SOURCE_REGISTRY", () => {
  it("tiene identificadores únicos", () => {
    const ids = SOURCE_REGISTRY.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("cada entrada tiene label y run", () => {
    for (const e of SOURCE_REGISTRY) {
      expect(typeof e.label).toBe("string");
      expect(e.label.length).toBeGreaterThan(0);
      expect(typeof e.run).toBe("function");
    }
  });

  it("ninguna fuente se etiqueta con su propio slug crudo", () => {
    // El bug original era justo este: la etiqueta era el slug de la fuente, así
    // que la pill pintaba "eventbrite" en lugar de un nombre legible. Compara
    // sin normalizar mayúsculas a propósito: "VAM" frente a "vam" es una
    // etiqueta hecha a mano y legítima.
    for (const e of SOURCE_REGISTRY) {
      expect(SOURCE_LABELS[e.id]).toBe(e.label);
      expect(e.label.length).toBeGreaterThan(0);
      expect(e.label).not.toBe(e.id);
    }
  });

  it("todo category del registro colorea bien", () => {
    for (const e of SOURCE_REGISTRY) {
      if (e.category) {
        expect(CATEGORY_COLORS[e.category]).toBeDefined();
      }
    }
  });

  it("declara exactamente las fuentes de la vista /culture", () => {
    // Escritas a mano, no derivadas con filter: si CULTURE_SOURCE_IDS se
    // definiera a sí mismo, este test no podría fallar nunca.
    expect([...CULTURE_SOURCE_IDS].sort()).toEqual([
      "fever",
      "gasteizhoy",
      "jimmyjazz",
      "municipal-agenda",
      "municipal-conciertos",
      "municipal-exposiciones",
      "municipal-teatro",
      "rula",
      "vam-conciertos",
    ]);
  });

  it("cada variante tipada del municipal tiene su propia entrada", () => {
    // El conjunto exacto, no una inclusión: si una combinación de argumentos
    // desaparece o se fusiona con otra, este test tiene que notarlo. Sin este
    // test, las visitas guiadas desaparecerían de la agenda sin error ni aviso.
    const ids = SOURCE_REGISTRY.filter(
      (e) => SOURCE_GROUPS[e.id] === "municipal"
    ).map((e) => e.id);
    expect(ids).toEqual(IDS_MUNICIPALES);
  });

  it("el municipal sin filtro va detrás de las variantes que llevan taxonomía", () => {
    // `?? NaN` en lugar de `!`: si un id desaparece, la aserción falla diciendo
    // NaN en vez de reventar con un TypeError fuera de ella.
    const prioridad = (id: string) =>
      SOURCE_REGISTRY.find((e) => e.id === id)?.priority ?? NaN;
    for (const variante of MUNICIPALES_CON_TAXONOMIA) {
      expect(prioridad(variante)).toBeLessThan(prioridad("municipal-general"));
    }
  });

  it("cada entrada que aporta kind o tags los declara con su valor exacto", () => {
    const esperado: Record<string, { kind?: string; tags?: string[] }> = {
      "municipal-deporte": { kind: "agenda" },
      "municipal-infantil": { tags: ["infantil"] },
      senderismo: { kind: "excursiones", tags: ["senderismo"] },
      "fiestas-blanca": { tags: ["la-blanca"] },
      "buscametas-calendario": { kind: "calendario" },
      "buscametas-inscripciones": { kind: "inscripciones" },
    };
    for (const [id, want] of Object.entries(esperado)) {
      const e = SOURCE_REGISTRY.find((x) => x.id === id);
      expect(e).toBeDefined();
      expect({ kind: e?.kind, tags: e?.tags }).toEqual(want);
    }
  });

  it("ninguna fuente municipal declara venta de entradas", () => {
    // El Ayuntamiento no vende entradas: si una variante municipal marcara
    // `tickets`, sus eventos rotularían el botón como "Comprar entradas".
    for (const e of SOURCE_REGISTRY) {
      if (SOURCE_GROUPS[e.id] === "municipal") {
        expect({ id: e.id, tickets: e.tickets }).toEqual({
          id: e.id,
          tickets: undefined,
        });
      }
    }
  });

  it("ninguna fuente queda etiquetada con su propio id", () => {
    // Restricción global: si alguien añade `{ id: "foo", label: "foo" }`, los
    // demás tests siguen en verde y la pill vuelve a pintar el slug crudo, que es
    // el fallo que esta tarea vino a matar.
    expect(Object.entries(SOURCE_LABELS).filter(([id, l]) => id === l)).toEqual([]);
  });
});
