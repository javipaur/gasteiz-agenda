/**
 * @jest-environment jsdom
 */

/**
 * `border-line` no existe. En `app/globals.css` los tokens de borde son
 * `--border` y `--border-hover`, que Tailwind v4 expone como `border-border` y
 * `border-border-hover`. `border-line` no se genera, así que la tarjeta y el botón
 * salían sin borde, sin error y sin aviso: el único síntoma es que el marco no está.
 */
import { escenario } from "../helpers-a11y";

type Modulo = { default: (props: Record<string, never>) => unknown };

function prepararNavegadorConPush(): void {
  Object.defineProperty(window.navigator, "serviceWorker", {
    configurable: true,
    value: {
      ready: Promise.resolve({
        pushManager: {
          getSubscription: async () => null,
          subscribe: async () => ({ toJSON: () => ({}) }),
        },
      }),
    },
  });
  (window as unknown as { PushManager: unknown }).PushManager = function PushManager() {};
  (globalThis as unknown as { Notification: unknown }).Notification = {
    permission: "default",
  };
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "BCl8ClaveDePrueba";
}

describe("PushNotifications", () => {
  it("el marco de la tarjeta usa un token de borde que existe", async () => {
    prepararNavegadorConPush();

    const { crear, montar, conProviders, modulo } = escenario<Modulo>(
      "@/app/components/PushNotifications"
    );
    const vista = montar(conProviders(crear(modulo.default, {})));
    await vista.asincrono();
    await vista.asincrono();

    // Con `status: "off"` se pinta el botón "Activar", que es el estado en el que
    // el componente sale y el borde se nota.
    const boton = vista.botonPorNombre("Activar");
    expect(boton).toBeDefined();

    const clases = Array.from(vista.contenedor.querySelectorAll("*"))
      .map((el) => el.getAttribute("class") ?? "")
      .join(" ");
    expect(clases).not.toContain("border-line");
    expect(clases).toContain("border-border");

    vista.desmontar();
  });
});