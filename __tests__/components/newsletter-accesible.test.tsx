/**
 * @jest-environment jsdom
 */

/**
 * El formulario de newsletter se identificaba solo con `placeholder`. El
 * placeholder desaparece en cuanto se escribe y no es un nombre accesible
 * confiable: hay inputs del repo que lo llevan bien (`HeroSearch`, `BusPageClient`,
 * `Header`) y estos dos se quedaron sin él.
 *
 * Y el error era un `<p>` más: sin `role="alert"` no se anuncia, sin `aria-invalid`
 * el campo no dice que está mal y sin `aria-describedby` nadie relaciona el mensaje
 * con el campo al que se refiere.
 */
import { escenario } from "../helpers-a11y";

/**
 * El `jest.fn()` vive **fuera** del factory a propósito, y el prefijo `mock` es lo
 * que permite cerrarlo desde ahí. Si el `jest.fn()` naciera dentro del factory,
 * `jest.isolateModules` lo crearía de nuevo en cada carga y el `mockReturnValue` de
 * este fichero se aplicaría a una función que el componente no está usando: mismo
 * "Invalid hook call" de nunca, pero sin mensaje.
 */
const mockSubscribe = jest.fn();

jest.mock("@/lib/useNewsletterSubscribe", () => ({
  useNewsletterSubscribe: mockSubscribe,
}));

type Modulo = { default: () => unknown };

const ERROR = "Ese correo no es válido";

describe.each([
  ["NewsLetter", "@/app/components/NewsLetter"],
  ["SubscribeForm", "@/app/components/SubscribeForm"],
])("%s", (_nombre, ruta) => {
  beforeEach(() => {
    mockSubscribe.mockReturnValue({
      email: "no-es-un-correo",
      setEmail: () => {},
      website: "",
      setWebsite: () => {},
      status: "error",
      message: ERROR,
      submit: () => {},
    });
  });

  it("el campo de correo tiene nombre propio, no solo placeholder", () => {
    const { crear, montar, conProviders, modulo } = escenario<Modulo>(ruta);
    const vista = montar(conProviders(crear(modulo.default, {})));

    const input = vista.consultar("input[type='email']")!;
    expect(input).not.toBeNull();
    expect(input.getAttribute("placeholder")).toBe("Tu email");
    // El nombre accesible tiene que existir y no puede ser el placeholder.
    expect(input.getAttribute("aria-label")).toBeTruthy();
    expect(input.getAttribute("aria-label")).not.toBe(input.getAttribute("placeholder"));

    vista.desmontar();
  });

  it("el error se anuncia y queda asociado al campo", () => {
    const { crear, montar, conProviders, modulo } = escenario<Modulo>(ruta);
    const vista = montar(conProviders(crear(modulo.default, {})));

    const alerta = vista.consultar('[role="alert"]');
    expect(alerta).not.toBeNull();
    expect(alerta!.textContent).toContain(ERROR);

    const input = vista.consultar("input[type='email']")!;
    expect(input.getAttribute("aria-invalid")).toBe("true");

    const descritoPor = input.getAttribute("aria-describedby");
    expect(descritoPor).toBeTruthy();
    // Y no basta con apuntar: el id tiene que existir y ser el aviso.
    expect(document.getElementById(descritoPor!)).toBe(alerta);

    vista.desmontar();
  });
});