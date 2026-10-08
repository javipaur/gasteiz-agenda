import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  ORIGEN_PROMO,
  TAMANO_PROMO,
  urlDePromo,
  radioImagenPromo,
  urlImagenPromo,
  textoDelPie,
} from "@/lib/promo";
import { IMAGE_HOSTS } from "@/lib/image-hosts";
import { HOSTS_CON_WAF_QUE_RECHAZA_NODE } from "@/lib/image-proxy";

describe("el paquete de redes", () => {
  it("las tarjetas son 4:5, que es lo que ocupa más pantalla en el feed", () => {
    // El número va escrito porque su valor es el de avisar: si mañana alguien
    // cambia el tamaño a 1080×1080 por lo que sea, este test pregunta por qué.
    expect(TAMANO_PROMO).toEqual({ width: 1080, height: 1350 });
  });

  it("las URLs del paquete son absolutas y del sitio desplegado", () => {
    // Instagram necesita una URL que pueda descargar sin autenticación. Una URL
    // relativa no vale, y una de localhost menos.
    expect(urlDePromo("2026-10-07")).toBe(
      "https://gasteizclick.javierpalacio.es/api/promo/2026-10-07/portada"
    );
    expect(urlDePromo("2026-10-07", "concierto-de-prueba")).toBe(
      "https://gasteizclick.javierpalacio.es/api/promo/2026-10-07/evento/concierto-de-prueba"
    );
  });

  it("solo usa imágenes de hosts que el sitio sabe servir", () => {
    // Un host fuera de la lista deja un rectángulo vacío en el post, y desde fuera no
    // hay forma de saber por qué.
    expect(radioImagenPromo("https://www.vitoria-gasteiz.org/cartel.jpg")).toBe(
      "https://www.vitoria-gasteiz.org/cartel.jpg"
    );
    expect(radioImagenPromo("/logo.svg")).toBe("/logo.svg");
    expect(radioImagenPromo("https://cdn.desconocido.example/c.jpg")).toBeNull();
    expect(radioImagenPromo(null)).toBeNull();
    expect(radioImagenPromo(undefined)).toBeNull();
    expect(radioImagenPromo("")).toBeNull();
  });
});

describe("la imagen que la tarjeta le da a satori", () => {
// **Por qué esto es un test y no una nota.** `ImageResponse` descarga las imágenes
  // con el `fetch` de Node, cuyo User-Agent lleva la cadena "node". La Genterula tiene un
  // WAF que devuelve 403 a cualquier User-Agent que la contenga, y el efecto en un PNG no
  // es un error: es un rectángulo del color del fondo. Medido el 8 de octubre de 2026
  // contra `ImageResponse` de verdad, a 1080×1350: la tarjeta con la URL cruda pesa
  // 31795 bytes y la misma tarjeta sin imagen pesa 31795 bytes. Idénticas. Por el proxy,
  // 700427.
  const RULA = "https://lagenterula.com/wp-content/uploads/cartel.jpeg";

  it("un host cuyo WAF rechaza al UA de Node va por el proxy, no por su URL cruda", () => {
    expect(urlImagenPromo(RULA)).toBe(
      `${ORIGEN_PROMO}/api/img?url=${encodeURIComponent(RULA)}`
    );
    expect(urlImagenPromo("https://www.lagenterula.com/wp-content/uploads/c.jpeg")).toBe(
      `${ORIGEN_PROMO}/api/img?url=${encodeURIComponent(
        "https://www.lagenterula.com/wp-content/uploads/c.jpeg"
      )}`
    );
  });

  it("la URL que se le pasa a satori es absoluta, porque satori no resuelve relativas", () => {
    // Una ruta del propio sitio la acepta `radioImagenPromo`, pero `<img src="/logo.svg">`
    // dentro de `ImageResponse` no la descarga: no hay origen contra el que resolverla.
    // El fallo es el mismo que el del 403 y se ve igual: el hueco.
    expect(urlImagenPromo("/carteles/octubre.webp")).toBe(
      `${ORIGEN_PROMO}/carteles/octubre.webp`
    );
  });

  it("los demás hosts van directos, sin el rodeo del proxy", () => {
    // El proxy existe para los WAF que rechazan "node", no para todos: por lo demás es
    // un salto de más y un origen más que puede caerse. `debeUsarProxy` ya lo decide, y
    // aquí lo que se comprueba es que la tarjeta lo respeta.
    const directo = "https://www.vitoria-gasteiz.org/carteles/cartel.jpg";
    expect(urlImagenPromo(directo)).toBe(directo);
    expect(urlImagenPromo(directo)).not.toContain("/api/img");
  });

  it("lo que no sabe servir el sitio sigue sin pintarse, ahora en absoluto", () => {
    // El proxy no amplía la lista blanca: `/api/img` responde 400 a un host que no está
    // en `IMAGE_HOSTS`. Por eso el `null` se decide **antes** de decidir la ruta, y no
    // después: mandar al proxy una URL que el proxy va a rechazar solo convierte un 403
    // en un 400.
    expect(urlImagenPromo("https://cdn.desconocido.example/c.jpg")).toBeNull();
    expect(urlImagenPromo("")).toBeNull();
    expect(urlImagenPromo(null)).toBeNull();
    expect(urlImagenPromo(undefined)).toBeNull();
  });

  it("ningún host con WAF hostil sale crudo, y el día que añada uno también", () => {
    // La versión de esta comprobación con la lista escrita a mano fue
    // `expect(urlImagenPromo(RULA))`, y pasa hoy. La interesante es la de al lado: si
    // mañana entra un host nuevo en `HOSTS_CON_WAF_QUE_RECHAZA_NODE` y alguien añade su
    // nombre a un `if` en vez de tocar el predicado, esta lista se alarga y el host
    // sale crudo sin que ningún test se entere.
    const crudos = [...HOSTS_CON_WAF_QUE_RECHAZA_NODE]
      .map((host) => urlImagenPromo(`https://${host}/cartel.jpeg`))
      .filter((url) => url !== null && !url.startsWith(`${ORIGEN_PROMO}/api/img?`));

    expect(crudos).toEqual([]);
  });

  it("y ningún host sin WAF pasa por el proxy, que sería tirar el salto", () => {
    const porProxy = IMAGE_HOSTS.map((h) => h.hostname)
      .filter((host) => !HOSTS_CON_WAF_QUE_RECHAZA_NODE.has(host))
      .map((host) => urlImagenPromo(`https://${host}/cartel.jpeg`))
      .filter((url) => url !== null && url.startsWith(`${ORIGEN_PROMO}/api/img?`));

    expect(porProxy).toEqual([]);
  });

  it("las rutas del paquete usan `urlImagenPromo`, no el predicado crudo", () => {
    // El mismo guard que escribe `__tests__/image-hosts.test.ts` para `imagenServible`,
    // por el mismo motivo: las dos funciones devuelven algo distinto y el predicado
    // "funciona" en un test mientras deja un rectángulo vacío en un post ya publicado.
    // Nadie se da cuenta por el tipo de retorno, que en las dos es `string | null`.
    const rutas = [
      "app/api/promo/[fecha]/evento/[slug]/route.tsx",
      "app/api/promo/[fecha]/portada/route.tsx",
    ];
    const usos = rutas.filter((ruta) =>
      readFileSync(join(process.cwd(), ruta), "utf8").includes("radioImagenPromo(")
    );

    expect(usos).toEqual([]);
  });
});

describe("el pie de foto", () => {
  const ev = (title: string, location = "") => ({ title, location });

  it("con tres planes los lista y cuenta", () => {
    const texto = textoDelPie(
      [ev("Concierto en el Joyel", "Sala Ganueta"), ev("Cine", "Florida"), ev("Mercado", "")],
      "2026-10-07",
      "2026-10-07"
    );

    expect(texto).toContain("HOY");
    expect(texto).toContain("3 planes");
    expect(texto).toContain("• Concierto en el Joyel — Sala Ganueta");
  });

  it("uno solo en singular, que «1 planes» delata el generador", () => {
    expect(textoDelPie([ev("Uno")], "2026-10-07", "2026-10-07")).toContain("1 plan");
  });

  it("un día sin nada lo dice sin fingir que hay algo", () => {
    // La tentación aquí es rellenarlo. Un post que dice "hoy no hay nada" y aun así
    // lleva a la agenda es más útil que uno que inventa tres planes para no quedar
    // en blanco.
    const texto = textoDelPie([], "2026-10-07", "2026-10-07");

    expect(texto).toContain("HOY");
    expect(texto).toContain("no hay nada recomendado");
  });

  it("la ventana larga no dice HOY", () => {
    const texto = textoDelPie([ev("Uno")], "2026-10-10", "2026-10-11");

    expect(texto).toContain("ESTE FINDE");
    expect(texto).not.toContain("HOY");
  });
});