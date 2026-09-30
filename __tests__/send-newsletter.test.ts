/**
 * `scripts/send-newsletter.ts` no debería hablar con su propio despliegue por
 * HTTP.
 *
 * Pedía `/api/actividades/eventos/proximos` a `NEXT_PUBLIC_SITE_URL` sin
 * mandar `x-api-key`. Con el `startsWith("/api/actividades")` de antes eso
 * funcionaba por accidente: la ruta era pública. En cuanto `/api/actividades`
 * dejó de ser un prefijo público —que era el punto— el script se rompió, y se
 * rompió de la forma más difícil de detectar: no en el despliegue, sino un
 * martes a las nueve, cuando el cron resulta que no ha enviado nada y solo lo
 * dice un log.
 *
 * La solución no era devolver la ruta a la lista de públicas. Es que un script
 * del repo no debería depender de que su propio despliegue le deje pasar: si
 * corre en la misma máquina que sirve la web, ya tiene el agregador a mano, y
 * el resto del código (`app/api/*`, `lib/turismo.ts`, `lib/gastronomia.ts`)
 * llama a `getProximosEventos` directamente. Lo raro era el script.
 *
 * Lo que sí queda atado a la red es la parte de verdad: SMTP. Esa no se puede
 * evitar y por eso `lib/mail.ts` falla explícito en producción sin
 * `EMAIL_USER`/`EMAIL_PASS`.
 */

type Evento = { title: string; date: string; slug: string };

const getProximosEventos = jest.fn<Promise<Evento[]>, []>();
const getActiveSubscribers = jest.fn();
const sendWeeklyNewsletter = jest.fn();

jest.mock("@/lib/eventos", () => ({
  getProximosEventos: () => getProximosEventos(),
}));

jest.mock("@/lib/db", () => ({
  getActiveSubscribers: () => getActiveSubscribers(),
}));

jest.mock("@/lib/email", () => ({
  sendWeeklyNewsletter: (...args: unknown[]) =>
    (sendWeeklyNewsletter as (...a: unknown[]) => unknown)(...args),
}));

type Main = () => Promise<void>;

function cargarScript(): Main {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("@/scripts/send-newsletter") as { main: Main };
  return mod.main;
}

const EVENTO: Evento = { title: "Noche de piano", date: "2026-10-15", slug: "noche-de-piano" };

describe("el script de la newsletter", () => {
  let exitCodePrevio: typeof process.exitCode;

  beforeEach(() => {
    exitCodePrevio = process.exitCode;
    process.exitCode = undefined;
    getProximosEventos.mockReset().mockResolvedValue([EVENTO]);
    getActiveSubscribers.mockReset().mockReturnValue([
      { email: "a@ejemplo.test", token: "tok-a", active: true },
      { email: "b@ejemplo.test", token: "tok-b", active: true },
    ]);
    sendWeeklyNewsletter.mockReset().mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    process.exitCode = exitCodePrevio;
  });

  it("no pide nada por HTTP al propio sitio", async () => {
    // Este es el test que muerde. Si alguien vuelve a meter un `fetch` contra
    // `NEXT_PUBLIC_SITE_URL`, esto falla aunque la ruta siga siendo pública.
    const fetchSpy = jest.spyOn(globalThis, "fetch");

    await cargarScript()();

    const destinos = fetchSpy.mock.calls.map(([url]) => String(url));
    expect(destinos).toEqual([]);
    fetchSpy.mockRestore();
  });

  it("lee los eventos del agregador, que es lo que hacen el resto de rutas", async () => {
    await cargarScript()();

    expect(getProximosEventos).toHaveBeenCalledTimes(1);
  });

  it("manda un correo por cada suscriptor activo, con su token de baja", async () => {
    await cargarScript()();

    expect(sendWeeklyNewsletter).toHaveBeenCalledTimes(2);
    expect(sendWeeklyNewsletter).toHaveBeenNthCalledWith(
      1,
      [EVENTO],
      "a@ejemplo.test",
      "tok-a"
    );
  });

  it("sigue saliendo con código 1 si algún envío falla", async () => {
    // Lo mantiene `lib/mail.ts`, que devuelve `ok: false` en producción sin
    // credenciales. Si el script se olvidara del código de salida, un cron
    // daría la newsletter por buena sin haber enviado nada.
    sendWeeklyNewsletter
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, error: "SMTP caído" });

    await cargarScript()();

    expect(process.exitCode).toBe(1);
  });

  it("sigue saliendo con código 0 si todo va bien", async () => {
    await cargarScript()();

    expect(process.exitCode).toBeUndefined();
  });

  it("sin eventos no llama al correo ni marca error", async () => {
    getProximosEventos.mockResolvedValue([]);

    await cargarScript()();

    expect(sendWeeklyNewsletter).not.toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
  });

  it("sin suscriptores no llama al correo ni marca error", async () => {
    getActiveSubscribers.mockReturnValue([]);

    await cargarScript()();

    expect(sendWeeklyNewsletter).not.toHaveBeenCalled();
    expect(process.exitCode).toBeUndefined();
  });
});
