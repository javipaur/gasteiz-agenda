/**
 * @jest-environment jsdom
 */

/**
 * Micro-defects sueltos, agrupados porque todos son de un solo fichero cada uno y
 * ninguno comparte componente. Se prueban de cinco formas distintas, que es lo que
 * hace que cada test afirme algo y no "que el fichero cambió".
 */
import { escenario } from "../helpers-a11y";

/**
 * El logger de Axiom se conecta por `fetch` al montar y su `WebVitals` observa la
 * navegación. Aquí solo se necesita el texto, así que se sustituye.
 */
jest.mock("@/lib/axiom/client", () => ({
  useLogger: () => ({ error: () => {}, warn: () => {}, info: () => {} }),
}));

type Modulo = { default: (props?: Record<string, unknown>) => unknown };

describe("MovieCard", () => {
  it("la insignia no dice HOY y el bloque de entradas no finge ser un botón", () => {
    // `HOY` estaba escrito a mano en la insignia, así que la cartelera decía
    // "hoy" aunque el dato fuera de otro día, y `formatDate()` —la función que
    // debería dar esa fecha— estaba definida y sin usarse en ningún sitio. Ahora la
    // insignia dice cuántas sesiones hay, que sale de los datos.
    //
    // Y el "Comprar entradas" era un `<div>` con `hover:` y `active:scale`: dentro
    // de la tarjeta, que ya es un `<a>`, un control que parece pulsable pero no lo
    // es. Como `<p>` se lee como parte de la tarjeta, que es lo que es.
    const { crear, montar, modulo } = escenario<Modulo>("@/app/components/MovieCard");
    const vista = montar(
      crear(modulo.default, {
        pelicula: {
          titulo: "La película",
          duracion: "120 min",
          genero: "Drama",
          imagen: "https://www.vitoria-gasteiz.org/cartel.jpg",
          link: "https://example.com/entradas",
          horarios: ["18:00", "20:30", "22:45"],
          cine: "Florida",
        },
      })
    );

    const texto = vista.texto();
    expect(texto).not.toContain("HOY");
    expect(texto).toContain("3 sesiones");

    const tarjeta = vista.consultar("a")!;
    // Tiene que ser un `<p>`: antes era un `<div>`, y hay al menos un `<p>` con ese
    // texto o el test falla. Los `<span>` de dentro no cuentan.
    const cta = Array.from(tarjeta.querySelectorAll("p")).find((p) =>
      (p.textContent ?? "").includes("Comprar entradas")
    );
    expect(cta).toBeDefined();
    expect(cta!.className).not.toContain("hover:");
    expect(cta!.className).not.toContain("active:");

    vista.desmontar();
  });
});

describe("AddToCalendar", () => {
  it("el nombre accesible contiene el texto que se ve (WCAG 2.5.3)", () => {
    // El enlace se leía "Añadir a Google Calendar" y ponía "Añadir al calendario".
    // Voz y texto distintos es la archetypal falla de "label in name": quien usa
    // el comando de voz y busca el botón que ve no lo encuentra.
    const { crear, montar, conProviders, modulo } = escenario<Modulo>(
      "@/app/components/AddToCalendar"
    );
    const vista = montar(
      conProviders(
        crear(modulo.default, {
          title: "Concierto",
          date: "2099-03-04",
          time: "20:00",
          location: "Sala Gimeno",
          slug: "concierto",
        })
      )
    );

    const enlace = vista.consultar("a")!;
    const visible = (enlace.textContent ?? "").trim();
    const nombre = enlace.getAttribute("aria-label")!;
    expect(visible).toBe("Añadir al calendario");
    expect(nombre).toContain(visible);

    vista.desmontar();
  });
});

describe("GastronomiaPageClient", () => {
  it("el precio usa un texto solo para lectores en vez de aria-label en un span", () => {
    // `aria-label` sobre un `<span>` genérico no es un nombre accesible fiable: la
    // especificación solo lo define para elementos con rol, y muchos lectores lo
    // ignoran. Con un `sr-only` el texto se lee siempre.
    const { crear, montar, conProviders, modulo } = escenario<Modulo>(
      "@/app/components/GastronomiaPageClient"
    );
    const vista = montar(
      conProviders(
        crear(modulo.default, {
          sitios: [
            {
              slug: "bar",
              nombre: "Bar",
              barrio: "Centro",
              tipoCocina: "Casual",
              descripcion: "d",
              direccion: "Calle 1",
              imagen: "",
              rangoPrecio: "€€",
              linkMaps: "https://maps.example.com",
            },
          ],
          rutas: [],
          eventos: [],
        })
      )
    );

    const precio = vista.consultar("span[aria-label]");
    expect(precio).toBeNull();
    const oculto = vista.consultar(".sr-only");
    expect(oculto!.textContent).toBe("Precio €€");

    vista.desmontar();
  });
});

describe("error boundary raíz", () => {
  it("no afirma que falla la carga de los eventos", () => {
    // `app/error.tsx` es el error boundary raíz: también cubre `/privacidad`,
    // `/aviso-legal`, `/docs` y `/bus`, donde no hay eventos que cargar. Decir
    // "ha habido un problema al cargar los eventos" es afirmar algo falso sobre la
    // página que se está viendo.
    const { crear, montar, modulo } = escenario<{
      default: (props: Record<string, unknown>) => unknown;
    }>("@/app/error");

    const vista = montar(
      crear(modulo.default, { error: new Error("boom"), reset: () => {} })
    );

    expect(vista.texto()).not.toContain("cargar los eventos");
    expect(vista.texto()).toContain("esta página");

    vista.desmontar();
  });
});

describe("detalle de evento", () => {
  it("no suelta el nombre del sitio como párrafo suelto al final", async () => {
    jest.mock("@/lib/agenda", () => ({
      getEventoBySlug: async () => ({
        evento: {
          id: "e1",
          slug: "concierto",
          title: "Concierto",
          date: "2099-03-04T20:00:00",
          time: "20:00",
          location: "Sala Gimeno",
          source: "jimmyjazz",
          description: "Un concierto.",
          category: "Conciertos",
          link: "https://example.com",
        },
        related: [],
      }),
    }));

    const { crear, montar, conProviders, modulo } = escenario<{
      default: (props: Record<string, unknown>) => Promise<unknown>;
    }>("@/app/evento/[slug]/page");

    const nodo = await modulo.default({ params: Promise.resolve({ slug: "concierto" }) });
    const vista = montar(conProviders(crear("div", { children: nodo })));

    // El `<p class="sr-only">` con el nombre del sitio se anunciaba al final del
    // artículo como texto suelto, sin decir nada. Un nombre de sitio no es un
    // mensaje para quien está leyendo la página.
    const sueltos = vista.consultarTodos("p.sr-only");
    for (const p of sueltos) {
      expect((p.textContent ?? "").trim()).not.toBe("Gasteiz Click");
    }

    vista.desmontar();
  });
});