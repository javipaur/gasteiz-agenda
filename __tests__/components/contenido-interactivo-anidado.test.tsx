/**
 * @jest-environment jsdom
 */

/**
 * Contenido interactivo anidado.
 *
 * El contenido de `a` y de `button` no puede ser interactivo. Con un `<button>`
 * de favorito dentro del `<a>` de la tarjeta, el resultado es HTML inválido y el
 * nombre accesible de la tarjeta sale como "enlace con botón": el lector anuncia
 * un control dentro de otro control y el teclado tiene dos paradas donde debería
 * tener una.
 *
 * Estos tests se montan sobre el árbol real, providers incluidos, y preguntan por
 * la estructura y no por el marcado concreto: si mañana el botón de favorito se
 * mueve a un overlay o a un hermano, el test sigue diciendo lo que dice.
 */
import { escenario, interactivoDentroDeInteractivo } from "../helpers-a11y";

type Evento = {
  id: string;
  slug: string;
  title: string;
  date: string;
  image?: string;
  location: string;
  link: string;
  category: string;
  source: string;
};

const EVENTO: Evento = {
  id: "evento-1",
  slug: "concierto-de-prueba",
  title: "Concierto de prueba",
  date: "2099-03-04",
  image: "https://example.com/cartel.jpg",
  location: "Sala Gimeno",
  link: "https://example.com/entradas",
  category: "Conciertos",
  source: "jimmyjazz",
};

/** `next/dynamic` carga un módulo real que a su vez importa `leaflet`. */
jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => () => null,
}));

describe("contenido interactivo anidado", () => {
  it("la tarjeta compartida no deja el favorito ni compartir dentro del enlace", () => {
    // `lib/shared.tsx` la usan la home, `/favoritos` y La Blanca: si aquí hay un
    // botón dentro del `<a>`, el defecto está en tres sitios a la vez.
    const { crear, montar, conProviders, modulo } = escenario<{
      EventCard: (props: Record<string, unknown>) => unknown;
    }>("@/lib/shared");

    const vista = montar(
      conProviders(crear(modulo.EventCard, { evento: { ...EVENTO, rating: 4.5 } }))
    );

    expect(interactivoDentroDeInteractivo(vista)).toEqual([]);

    // Los dos controles siguen ahí y siguen siendo alcanzables: lo que cambia es
    // que ya no viven dentro del ancla.
    expect(vista.consultar("a[href='/evento/concierto-de-prueba']")).not.toBeNull();
    expect(vista.consultarTodos("button")).toHaveLength(2);
    const favoritos = vista.consultar(
      "button[aria-label='Añadir a favoritos'], button[aria-label='Quitar de favoritos']"
    );
    expect(favoritos).not.toBeNull();
    expect(favoritos!.closest("a")).toBeNull();
    expect(vista.consultar("button[aria-label='Compartir evento']")!.closest("a")).toBeNull();

    vista.desmontar();
  });

  it.each([
    ["CulturePageClient", "@/app/components/CulturePageClient", true],
    ["ConciertosPageClient", "@/app/components/ConciertosPageClient", false],
    ["KidsPageClient", "@/app/components/KidsPageClient", false],
    ["SportPageClient", "@/app/components/SportPageClient", false],
  ])(
    "%s saca el favorito de fuera del enlace de la tarjeta",
    (_nombre, ruta, conAhora) => {
      const { crear, montar, conProviders, modulo } = escenario<{
        default: (props: Record<string, unknown>) => unknown;
      }>(ruta);

      const props: Record<string, unknown> = { eventos: [EVENTO] };
      if (conAhora) props.ahora = Date.UTC(2099, 0, 1);

      const vista = montar(conProviders(crear(modulo.default, props)));

      expect(interactivoDentroDeInteractivo(vista)).toEqual([]);

      const favorito = vista.consultar(
        "button[aria-label='Añadir a favoritos'], button[aria-label='Quitar de favoritos']"
      );
      expect(favorito).not.toBeNull();
      expect(favorito!.closest("a")).toBeNull();
      expect(vista.consultar("a[href='/evento/concierto-de-prueba']")).not.toBeNull();

      vista.desmontar();
    }
  );

  it("el teléfono de una farmacia no cuelga del botón que la selecciona", async () => {
    // El patrón viejo era un `<a href="tel:">` dentro del `<button>` de la tarjeta
    // más un `stopPropagation` en el `onClick` del enlace. El `stopPropagation` era
    // la prueba de que el enlace no era hijo suyo: con el `<a>` como hermano, deja
    // de hacer falta y el enlace vuelve a ser un enlace normal.
    const respuesta = {
      ok: true,
      json: async () => ({
        date: "2099-03-04",
        fetchedAt: 1,
        data: [
          {
            id: "f1",
            name: "Farmacia Test",
            shortAddress: "Calle Mayor 1",
            horarios: "L-V 9:00-14:00",
            phone: "945 123 456",
            lat: 42.85,
            lng: -2.67,
          },
        ],
      }),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).fetch = jest.fn(async () => respuesta);

    const { crear, montar, conProviders, modulo } = escenario<{
      default: (props: Record<string, unknown>) => unknown;
    }>("@/app/components/FarmaciasPageClient");

    const vista = montar(
      conProviders(crear(modulo.default, { ahora: Date.UTC(2099, 2, 4) }))
    );
    await vista.asincrono();
    await vista.asincrono();

    expect(interactivoDentroDeInteractivo(vista)).toEqual([]);

    const telefono = vista.consultar("a[href^='tel:']");
    expect(telefono).not.toBeNull();
    expect(telefono!.closest("button")).toBeNull();
    expect(telefono!.textContent).toContain("945 123 456");
    expect(vista.consultar("li > button")).not.toBeNull();

    vista.desmontar();
  });
});