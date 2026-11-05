import {
  bloqueDeEvento,
  bloqueDeFarmacias,
  EMOJI_CATEGORIA,
  emojiDeCategoria,
  enlaceDeBoletin,
  etiquetaDeDia,
  etiquetaDeVentana,
  fechaLarga,
  LIMITE_BOLETIN,
  resumenDeBoletin,
  seleccionarDelDia,
  textoDelBoletin,
  titularDeBoletin,
} from "@/lib/boletin";
import type { AgendaEvento } from "@/lib/agenda";
import type { FarmaciaGuardia } from "@/lib/sources/farmacias-guardia";

/**
 * El boletín no se prueba comparando el texto entero contra un literal: eso fija
 * la redacción y convierte cualquier retoque de copy en un rojo, que enseña a
 * actualizar el test sin leerlo. Se prueban las **reglas** que no se ven a
 * simple vista: el día local, el orden, lo que no se escribe y lo que no se
 * inventa.
 */

function evento(over: Partial<AgendaEvento> & { slug: string }): AgendaEvento {
  return {
    id: over.slug,
    title: over.slug,
    date: "2026-11-04T10:00:00.000Z",
    location: "Vitoria-Gasteiz",
    link: "https://example.com",
    category: "Otros",
    source: "municipal",
    ...over,
  };
}

describe("emojiDeCategoria", () => {
  it("tiene un emoji para cada categoría de la taxonomía", () => {
    // Las dieciséis de `lib/categories.ts`. Si se añade una allí y no aquí, el
    // boletín la pinta como `Otros` sin que nada avise.
    expect(Object.keys(EMOJI_CATEGORIA)).toHaveLength(16);
  });

  it("cae en el emoji de Otros cuando la categoría no está en el mapa", () => {
    expect(emojiDeCategoria("Categoría que no existe")).toBe(EMOJI_CATEGORIA.Otros);
    expect(emojiDeCategoria("")).toBe(EMOJI_CATEGORIA.Otros);
  });

  it("normaliza la categoría antes de buscarla", () => {
    // `normalizeCategory` traduce "formacion" a "Talleres"; el boletín tiene que
    // usar la misma puerta y no comparar el string crudo.
    expect(emojiDeCategoria("formacion")).toBe(EMOJI_CATEGORIA.Talleres);
    expect(emojiDeCategoria("TEATRO Y DANZA")).toBe(EMOJI_CATEGORIA.Teatro);
  });
});

describe("titularDeBoletin", () => {
  it("aplica la normalización del carrusel", () => {
    const conErrata = evento({ slug: "a", title: "Concierto en Vitoira-Gasteiz" });
    expect(titularDeBoletin(conErrata)).toBe("Concierto en Vitoria-Gasteiz");

    const conFecha = evento({ slug: "b", title: "PAULA MATTHEUS (23 de octubre, Vitoria-Gasteiz)" });
    expect(titularDeBoletin(conFecha)).toBe("PAULA MATTHEUS");
  });

  it("no cambia la caja del título", () => {
    // La regla tipográfica del proyecto: las mayúsculas son de las etiquetas, no
    // de los títulos. El carrusel puede permitirse caja alta bajo una foto; un
    // chat no, y aquí no se toca ni para bien.
    const minusculas = evento({ slug: "c", title: "taller de cerámica" });
    expect(titularDeBoletin(minusculas)).toBe("taller de cerámica");
  });
});

describe("resumenDeBoletin", () => {
  it("devuelve null sin descripción", () => {
    expect(resumenDeBoletin(undefined)).toBeNull();
    expect(resumenDeBoletin(null)).toBeNull();
    expect(resumenDeBoletin("   ")).toBeNull();
  });

  it("descarta una etiqueta corta, que es lo que el municipal llama descripción", () => {
    // El calendario municipal publica el destinatario en `description`: "Otros",
    // "Adulto", "Familiar". Sueltos bajo el titular se leen como un error de
    // formato, no como un resumen.
    expect(resumenDeBoletin("Otros")).toBeNull();
    expect(resumenDeBoletin("Adulto")).toBeNull();
    expect(resumenDeBoletin("Todos los públicos")).toBeNull();
  });

  it("desescapa entidades y quita etiquetas HTML", () => {
    const texto = resumenDeBoletin(
      "<p>Una tarde de <strong>juegos</strong> para toda la familia&nbsp;en el parque.</p>"
    );
    expect(texto).toBe("Una tarde de juegos para toda la familia en el parque.");
  });

  it("corta por frase cuando hay una entera dentro del margen", () => {
    const frase = "Esta es la primera frase del resumen que sí cabe entera.";
    const relleno = " Y esta segunda parte es mucho más larga y no debería aparecer.";
    const texto = resumenDeBoletin(frase + relleno, frase.length + 10);
    expect(texto).toBe(frase);
  });

  it("corta por palabra y no por la mitad cuando no hay frase", () => {
    const texto = resumenDeBoletin("palabra ".repeat(60), 100);
    expect(texto?.endsWith("…")).toBe(true);
    expect(texto).not.toMatch(/\s…$/);
    expect(texto!.length).toBeLessThanOrEqual(101);
  });
});

describe("fechaLarga", () => {
  it("escribe el día de la semana y el mes en castellano", () => {
    expect(fechaLarga("2026-11-04")).toBe("miércoles, 4 de noviembre");
    expect(fechaLarga("2026-01-01")).toBe("jueves, 1 de enero");
  });

  it("devuelve la entrada si no parsea, en vez de una fecha inventada", () => {
    expect(fechaLarga("no-es-una-fecha")).toBe("no-es-una-fecha");
  });
});

describe("etiquetaDeDia", () => {
  it("dice HOY solo si de verdad es hoy", () => {
    expect(etiquetaDeDia("2026-11-04", "2026-11-04")).toBe("HOY MIÉRCOLES");
  });

  it("si no es hoy, dice el día y el número", () => {
    expect(etiquetaDeDia("2026-11-07", "2026-11-04")).toBe("SÁBADO 7");
  });
});

describe("etiquetaDeVentana", () => {
  it("un plan de un solo día usa la etiqueta de día", () => {
    expect(etiquetaDeVentana("2026-11-04", "2026-11-04", "2026-11-04")).toBe("HOY MIÉRCOLES");
  });

  it("lo que ya empezó dice hasta cuándo, no desde cuándo", () => {
    // Una exposición abierta desde septiembre no "empieza" hoy: lo que importa
    // es cuándo se acaba.
    expect(etiquetaDeVentana("2026-09-05", "2026-11-08", "2026-11-04")).toBe(
      "HASTA EL 8 DE NOVIEMBRE"
    );
  });

  it("lo que empieza más adelante dice el rango", () => {
    expect(etiquetaDeVentana("2026-11-06", "2026-11-08", "2026-11-04")).toBe(
      "DEL 6 AL 8 DE NOVIEMBRE"
    );
  });

  it("un rango que cruza de mes nombra los dos meses", () => {
    expect(etiquetaDeVentana("2026-11-30", "2026-12-03", "2026-11-04")).toBe(
      "DEL 30 DE NOVIEMBRE AL 3 DE DICIEMBRE"
    );
  });
});

describe("seleccionarDelDia", () => {
  it("filtra por día local y no por el prefijo ISO", () => {
    // `2026-11-04T23:30:00.000Z` en Madrid son las 00:30 del día 5. Un
    // `date.slice(0, 10)` lo dejaría en el boletín del día 4, que es el día en
    // que nadie puede ir.
    const tarde = evento({ slug: "tarde", date: "2026-11-04T23:30:00.000Z" });

    expect(seleccionarDelDia([tarde], "2026-11-04")).toHaveLength(0);
    expect(seleccionarDelDia([tarde], "2026-11-05")).toHaveLength(1);
  });

  it("ordena por interés y no por hora", () => {
    // El orden es el de la portada y el del carrusel, no el del reloj: un plan de
    // las 19:00 con foto y precio puntúa más que uno de las 10:00 sin nada, y va
    // primero. Antes el chat empezaba por la hora y la web por el interés, así
    // que el mismo día se leía de dos maneras.
    const temprano = evento({ slug: "temprano", time: "10:00" });
    const tarde = evento({
      slug: "tarde",
      time: "19:00",
      image: "https://example.com/cartel.jpg",
      price: "8 €",
    });

    expect(seleccionarDelDia([temprano, tarde], "2026-11-04").map((e) => e.slug)).toEqual([
      "tarde",
      "temprano",
    ]);
  });

  it("incluye lo que dura varios días, detrás de lo que empieza hoy", () => {
    // Una exposición abierta desde septiembre es un plan de hoy, pero el bono de
    // cercanía de `scoreEvento` se mide por la fecha de inicio, que ya pasó: se
    // queda detrás de lo que empieza hoy sin necesidad de un segundo bloque.
    const enMarcha = evento({
      slug: "en-marcha",
      date: "2026-09-01T10:00:00.000Z",
      dateEnd: "2026-12-20T10:00:00.000Z",
    });
    const deHoy = evento({ slug: "de-hoy", time: "20:00" });

    expect(seleccionarDelDia([enMarcha, deHoy], "2026-11-04").map((e) => e.slug)).toEqual([
      "de-hoy",
      "en-marcha",
    ]);
  });

  it("no mete lo que ya terminó", () => {
    const terminado = evento({
      slug: "terminado",
      date: "2026-10-01T10:00:00.000Z",
      dateEnd: "2026-11-03T10:00:00.000Z",
    });
    expect(seleccionarDelDia([terminado], "2026-11-04")).toHaveLength(0);
  });

  it("deduplica por slug y respeta el límite", () => {
    const repetido = evento({ slug: "repetido", time: "10:00" });
    const otros = Array.from({ length: LIMITE_BOLETIN + 5 }, (_, i) =>
      evento({ slug: `e${i}`, time: `1${i % 10}:00` })
    );

    const seleccion = seleccionarDelDia([repetido, repetido, ...otros], "2026-11-04");

    expect(seleccion).toHaveLength(LIMITE_BOLETIN);
    expect(seleccion.filter((e) => e.slug === "repetido")).toHaveLength(1);
  });

  it("cambia el último plan por el mejor familiar cuando no hay ninguno en el top", () => {
    // `Infantil` pesa 26 y aun así pierde casi siempre: hay uno por semana y los
    // otros cientos no. El hueco es para que las familias tengan algo, no para
    // decir que su plan es el mejor del día, así que se cambia el último.
    const concurrido = (slug: string) =>
      evento({
        slug,
        category: "Música",
        image: "https://example.com/cartel.jpg",
        price: "10 €",
      });
    const familiar = evento({ slug: "cuentacuentos-familias", category: "Infantil" });

    const seleccion = seleccionarDelDia(
      [concurrido("concierto-a"), concurrido("concierto-b"), concurrido("concierto-c"), familiar],
      "2026-11-04",
      3
    );

    expect(seleccion.map((e) => e.slug)).toEqual([
      "concierto-a",
      "concierto-b",
      "cuentacuentos-familias",
    ]);
  });

  it("no toca la lista si el top ya tiene un plan familiar", () => {
    const familiar = evento({
      slug: "cuentacuentos-familias",
      category: "Infantil",
      image: "https://example.com/cartel.jpg",
      price: "3 €",
    });
    const otros = ["concierto-a", "concierto-b"].map((slug) => evento({ slug, category: "Música" }));

    const seleccion = seleccionarDelDia([familiar, ...otros], "2026-11-04", 3);

    expect(seleccion.map((e) => e.slug)).toEqual([
      "cuentacuentos-familias",
      "concierto-a",
      "concierto-b",
    ]);
  });

  it("deja la lista como está si no hay ningún plan familiar", () => {
    // Inventar uno o dejar el hueco vacío sería peor que no tener el hueco.
    const otros = ["concierto-a", "concierto-b", "concierto-c"].map((slug) =>
      evento({ slug, category: "Música" })
    );

    const seleccion = seleccionarDelDia(otros, "2026-11-04", 3);

    expect(seleccion.map((e) => e.slug)).toEqual([
      "concierto-a",
      "concierto-b",
      "concierto-c",
    ]);
  });
});

describe("bloqueDeEvento", () => {
  it("no repite Vitoria-Gasteiz, que es el valor por defecto del agregador", () => {
    const bloque = bloqueDeEvento(evento({ slug: "a" }), { hoy: "2026-11-04" });
    expect(bloque).not.toContain("📍");
  });

  it("no repite el titular como si fuera el sitio", () => {
    const bloque = bloqueDeEvento(
      evento({ slug: "b", title: "Mercado de Lakua", location: "Mercado de Lakua" }),
      { hoy: "2026-11-04" }
    );
    expect(bloque).not.toContain("📍");
  });

  it("escribe el sitio cuando no es ni la ciudad ni el título", () => {
    const bloque = bloqueDeEvento(evento({ slug: "c", location: "Palacio Europa" }), {
      hoy: "2026-11-04",
    });
    expect(bloque).toContain("📍 Palacio Europa");
  });

  it("solo pone precio si la fuente lo publica", () => {
    const sinPrecio = bloqueDeEvento(evento({ slug: "d" }), { hoy: "2026-11-04" });
    expect(sinPrecio).not.toContain("🎟️");

    const conPrecio = bloqueDeEvento(evento({ slug: "e", price: "12 €" }), {
      hoy: "2026-11-04",
    });
    expect(conPrecio).toContain("🎟️ 12 €");
  });

  it("enlaza a la ficha de aquí y no a la web de origen", () => {
    const bloque = bloqueDeEvento(evento({ slug: "mi-plan", link: "https://otro-sitio.com" }), {
      hoy: "2026-11-04",
    });
    expect(bloque).toContain(`👉 ${enlaceDeBoletin(evento({ slug: "mi-plan" }))}`);
    expect(bloque).not.toContain("otro-sitio.com");
  });
});

describe("bloqueDeFarmacias", () => {
  function farmacia(i: number): FarmaciaGuardia {
    return {
      id: String(i),
      name: `Farmacia ${i}`,
      address: `Calle ${i}`,
      shortAddress: `C/${i}`,
      phone: "",
      date: "2026-11-04",
      horarios: "09:00-22:00",
      neighborhood: "",
      city: "Vitoria-Gasteiz",
      zone: "",
      lat: "0",
      lng: "0",
      guardia: "diurna",
    };
  }

  it("devuelve null sin farmacias, y así el bloque no aparece", () => {
    expect(bloqueDeFarmacias([])).toBeNull();
  });

  it("lista hasta ocho y resume el resto", () => {
    const bloque = bloqueDeFarmacias(Array.from({ length: 11 }, (_, i) => farmacia(i)));
    expect(bloque).toContain("Farmacia 7");
    expect(bloque).not.toContain("Farmacia 8");
    expect(bloque).toContain("y 3 más");
  });
});

describe("textoDelBoletin", () => {
  const hoy = "2026-11-04";

  it("empieza con el saludo y la cabecera fechada", () => {
    const { texto } = textoDelBoletin({ fecha: hoy, eventos: [] });
    const lineas = texto.split("\n\n");

    expect(lineas[0]).toBe("☀️ ¡Buenos días, Gasteiz! Egun on!");
    expect(lineas[1]).toBe("ESTO ES GASTEIZNEWS, miércoles, 4 de noviembre");
  });

  it("cierra con el enlace a la agenda entera", () => {
    const { texto } = textoDelBoletin({ fecha: hoy, eventos: [] });
    expect(texto.trimEnd().endsWith("👉 Toda la agenda, en https://gasteizclick.javierpalacio.es")).toBe(
      true
    );
  });

  it("no escribe bloques que no tienen fuente", () => {
    // Tiempo, gasolina, sopa y titulares de política están en el formato de
    // referencia y no en este repositorio. Inventarlos sería el fallo de siempre:
    // un texto que afirma algo que nadie ha comprobado.
    const { texto } = textoDelBoletin({ fecha: hoy, eventos: [evento({ slug: "a" })] });
    for (const inventado of ["🌡️", "⛽", "Sopa", "Gasolina", "El tiempo"]) {
      expect(texto).not.toContain(inventado);
    }
  });

  it("devuelve los eventos elegidos para que quien llama sepa cuántos hay", () => {
    const dentro = evento({ slug: "dentro", time: "10:00" });
    const fuera = evento({ slug: "fuera", date: "2026-11-20T10:00:00.000Z" });

    const { eventos } = textoDelBoletin({ fecha: hoy, eventos: [dentro, fuera] });

    expect(eventos.map((e) => e.slug)).toEqual(["dentro"]);
  });

  it("respeta un hoy distinto de la fecha cuando se le pasa", () => {
    // El script pasa la fecha y no lee el reloj; separar `hoy` de `fecha` permite
    // preparar el boletín de mañana sin que diga "HOY" de un día que no es.
    const { texto } = textoDelBoletin({
      fecha: "2026-11-05",
      hoy,
      eventos: [evento({ slug: "a", date: "2026-11-05T10:00:00.000Z", time: "10:00" })],
    });

    expect(texto).toContain("JUEVES 5");
    expect(texto).not.toContain("HOY JUEVES");
  });
});
