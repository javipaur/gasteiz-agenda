/**
 * `/api/log` recibe lo que le mande el navegador, y por eso necesita un techo.
 *
 * La ruta es un proxy a Axiom: `createProxyRouteHandler(logger)` se come la
 * petición tal cual. Es la respuesta correcta para un *log* —el navegador tiene
 * el `Logger` y sus `console.warn` no se pueden mandar de otra forma—, pero
 * significa que cualquiera puede hacer que el servidor vacíe un cuerpo de
 * cualquier tamaño contra el proxy. Con `Access-Control-Allow-Origin: *`
 * —que es lo que `next.config.ts` pone a toda ruta de `PUBLIC_API_ROUTES`—, no
 * hace falta ni estar en el sitio: lo hace un `<script>` de cualquier página.
 *
 * Por eso abrirla no es gratis: se abre **con un límite**, y el límite es lo que
 * distingue «hacer logs» de «amplificar peticiones».
 *
 * El 413 se comprueba contra la ruta real, con el proxy mockeado, porque lo que
 * importa es que el cuerpo grande no llegue al handler: si el techo se pusiera
 * dentro de Axiom, el cuerpo ya habría traveling entero por el proceso.
 */

type Route = typeof import("@/app/api/log/route");

jest.mock("@axiomhq/nextjs", () => ({
  createProxyRouteHandler: jest.fn(() =>
    jest.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
  ),
}));

jest.mock("@/lib/axiom/server", () => ({ logger: {} }));

function rutas(): Route {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@/app/api/log/route") as Route;
}

function post(cuerpo: string, cabeceras: Record<string, string> = {}): Request {
  return new Request("https://gasteizclick.test/api/log", {
    method: "POST",
    headers: { "content-type": "application/json", ...cabeceras },
    body: cuerpo,
  });
}

describe("POST /api/log", () => {
  it("rechaza un cuerpo por encima del techo con 413", async () => {
    const { POST } = rutas();

    const res = await POST(post(`{"data":"${"A".repeat(2_000_000)}"}`) as never);

    expect(res.status).toBe(413);
  });

  it("el 413 dice que el cuerpo es demasiado grande, no que está mal la clave", async () => {
    // La ruta es pública: un 401 aquí mandaría a quien depure a mirar su
    // `API_KEY` cuando el problema es que ha mandado medio gigabyte.
    const { POST } = rutas();

    const res = await POST(post(`{"data":"${"A".repeat(200_000)}"}`) as never);

    expect(res.status).toBe(413);
    expect((await res.json()).error).toMatch(/grande|too large/i);
  });

  it("pasa un cuerpo normal al proxy sin tocarlo", async () => {
    // La mitad complementaria: un límite que se pasara de corto dejaría la web sin
    // logs, que es el problema que esto vino a arreglar.
    const { POST } = rutas();
    const cuerpo = JSON.stringify({ _events: [{ level: "warn", data: "hola" }] });

    const res = await POST(post(cuerpo) as never);

    expect(res.status).toBe(200);
  });

  it("el proxy recibe el mismo cuerpo que le mandaron", async () => {
    // Un límite implementado reescribiendo la petición podría recortar, vaciar o
    // codificar distinto el cuerpo y dejar a Axiom con otra cosa de la que cree.
    jest.resetModules();
    const recibido: string[] = [];
    jest.doMock("@axiomhq/nextjs", () => ({
      createProxyRouteHandler: jest.fn(() =>
        jest.fn(async (req: Request) => {
          recibido.push(await req.text());
          return new Response("{}", { status: 200 });
        })
      ),
    }));
    jest.doMock("@/lib/axiom/server", () => ({ logger: {} }));

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { POST } = require("@/app/api/log/route") as Route;
    const cuerpo = JSON.stringify({ _events: [{ level: "warn", data: "áéíóú ✉" }] });

    await POST(post(cuerpo) as never);

    expect(recibido).toEqual([cuerpo]);
  });

  it("mide en bytes y no en caracteres", async () => {
    // Un techo contado con `String.length` mide unidades UTF-16: los emoji pesan
    // dos. Con un cuerpo de emoji, un `length` mal puesto deja pasar el doble de
    // lo que dice el techo, que es justo el tipo de límite que se cree puesto y no
    // lo está.
    const { POST } = rutas();
    const emoji = "\u{1F3B5}\u{1F3AD}";

    const dentro = await POST(post(JSON.stringify({ data: emoji.repeat(2_000) })) as never);
    const fuera = await POST(post(JSON.stringify({ data: emoji.repeat(200_000) })) as never);

    expect(dentro.status).toBe(200);
    expect(fuera.status).toBe(413);
  });

  it("también avisa cuando solo miente el content-length", async () => {
    // El `content-length` es una cabecera que envía el cliente: si el techo se
    // calculase solo con ella, `content-length: 10` con 2 MB detrás pasaría de
    // largo. El cuerpo se mide, no se confía.
    const { POST } = rutas();

    const res = await POST(
      post(`{"data":"${"A".repeat(500_000)}"}`, { "content-length": "12" }) as never
    );

    expect(res.status).toBe(413);
  });

  it("GET sigue contestando lo que contestaba", async () => {
    // El techo es del `POST`. El `GET` no lleva cuerpo y es el que usan los
    // chequeos de vida: cerrarlo sería tirar una sonda por no mirar.
    const { GET } = rutas();

    const res = await GET();

    expect(res.status).toBe(200);
  });
});
