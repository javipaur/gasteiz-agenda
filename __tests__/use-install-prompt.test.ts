import { createInstallStore } from "@/lib/useInstallPrompt";

/**
 * `beforeinstallprompt` es de un solo uso por carga de página: el navegador lo
 * dispara una vez y `prompt()` lo consume. Estos tests fijan ese contrato sobre
 * un `EventTarget` de node, sin jsdom.
 *
 * El fallo que cubren es el que tenía el store: `promptInstall()` solo anulaba el
 * evento si el usuario **aceptaba**. Con un descarte el evento se quedaba
 * guardado y el siguiente clic llamaba a `prompt()` sobre un evento ya consumido,
 * que el navegador rechaza. `Header.tsx` e `InstallBanner.tsx` sí lo anulaban
 * siempre, cada uno con su propia copia; al unificar hay un solo sitio donde eso
 * puede volver a romperse.
 */

type Outcome = "accepted" | "dismissed";

function eventoCon(outcome: Outcome) {
  const evento = new Event("beforeinstallprompt") as Event & {
    prompt: jest.Mock;
    userChoice: Promise<{ outcome: Outcome }>;
    preventDefault: jest.Mock;
  };
  evento.prompt = jest.fn().mockResolvedValue(undefined);
  evento.userChoice = Promise.resolve({ outcome });
  evento.preventDefault = jest.fn();
  return evento;
}

describe("el store de beforeinstallprompt", () => {
  it("no hay instalación disponible hasta que el navegador lo dice", () => {
    const store = createInstallStore(new EventTarget());
    expect(store.getAvailable()).toBe(false);
  });

  it("anula el evento para que el navegador muestre su diálogo", () => {
    // Sin `preventDefault` el navegador enseña su propio prompt, y el botón de
    // instalar de la web pasa a ser un segundo prompt por el mismo evento.
    const target = new EventTarget();
    const store = createInstallStore(target);

    const evento = eventoCon("accepted");
    target.dispatchEvent(evento);

    expect(evento.preventDefault).toHaveBeenCalledTimes(1);
    expect(store.getAvailable()).toBe(true);
  });

  it("el prompt se consume tanto si el usuario acepta como si lo descarta", async () => {
    // Este es el test que falla con el store de antes. Tras un descarte el evento
    // sigue siendo el mismo objeto ya consumido, y el store lo conservaba.
    for (const outcome of ["accepted", "dismissed"] as const) {
      const target = new EventTarget();
      const store = createInstallStore(target);
      const evento = eventoCon(outcome);
      target.dispatchEvent(evento);

      await expect(store.prompt()).resolves.toBe(outcome);
      expect(evento.prompt).toHaveBeenCalledTimes(1);
      expect(store.getAvailable()).toBe(false);
    }
  });

  it("un segundo clic tras descartar no vuelve a llamar a prompt()", async () => {
    const target = new EventTarget();
    const store = createInstallStore(target);
    const evento = eventoCon("dismissed");
    target.dispatchEvent(evento);

    await expect(store.prompt()).resolves.toBe("dismissed");
    // El evento ya está consumido. Lo que tiene que responder la web es "no
    // disponible", no una segunda llamada que el navegador va a rechazar.
    await expect(store.prompt()).resolves.toBe("unavailable");
    expect(evento.prompt).toHaveBeenCalledTimes(1);
    expect(store.getAvailable()).toBe(false);
  });

  it("sin evento, instalar dice que no está disponible en vez de romperse", async () => {
    const store = createInstallStore(new EventTarget());
    await expect(store.prompt()).resolves.toBe("unavailable");
  });

  it("un segundo beforeinstallprompt sustituye al anterior", async () => {
    // El navegador dispara uno por carga de página, pero si llegara otro no puede
    // quedar el viejo, porque `prompt()` sobre el viejo ya consumido falla.
    const target = new EventTarget();
    const store = createInstallStore(target);

    target.dispatchEvent(eventoCon("dismissed"));
    const segundo = eventoCon("accepted");
    target.dispatchEvent(segundo);

    await expect(store.prompt()).resolves.toBe("accepted");
    expect(segundo.prompt).toHaveBeenCalledTimes(1);
  });

  it("avisa a los suscriptores al aparecer el evento, y solo a los que siguen", () => {
    const target = new EventTarget();
    const store = createInstallStore(target);

    const cambios = jest.fn();
    const baja = store.subscribe(cambios);
    target.dispatchEvent(eventoCon("accepted"));
    expect(cambios).toHaveBeenCalledTimes(1);

    baja();
    target.dispatchEvent(eventoCon("accepted"));
    expect(cambios).toHaveBeenCalledTimes(1);
  });

  it("los suscriptores se enteran de que la instalación se consumió", async () => {
    // Sin este aviso el `InstallButton` seguiría pintándose después de instalar:
    // `useSyncExternalStore` solo repinta cuando le llega una notificación.
    const target = new EventTarget();
    const store = createInstallStore(target);

    const cambios = jest.fn();
    store.subscribe(cambios);
    target.dispatchEvent(eventoCon("accepted"));
    expect(cambios).toHaveBeenCalledTimes(1);

    await store.prompt();
    expect(cambios).toHaveBeenCalledTimes(2);
  });

  it("dos stores sobre el mismo target no comparten estado", async () => {
    // Aislar el estado es lo que permite probarlo en node con un `EventTarget`
    // falso en vez de necesitar una ventana de verdad. Cada store recibe su copia
    // del evento y la consume por su cuenta: el `deferred` vive en el cierre de
    // la fábrica, no en un módulo.
    const target = new EventTarget();
    const uno = createInstallStore(target);
    const otro = createInstallStore(target);
    const evento = eventoCon("accepted");

    target.dispatchEvent(evento);
    expect(uno.getAvailable()).toBe(true);
    expect(otro.getAvailable()).toBe(true);

    await uno.prompt();
    expect(uno.getAvailable()).toBe(false);
    expect(otro.getAvailable()).toBe(true);
  });
});