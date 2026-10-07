/**
 * La regla que decide si una imagen va por `/api/img` o por `/_next/image`.
 *
 * **Por qué esto importa.** El optimizador de `next/image` manda `user-agent: node`
 * hardcodeado (`BASE_REQ_HEADERS` en `image-optimizer.js` de Next 16) y no hay opción de
 * `next.config.ts` para cambiarlo. La Genterula bloquea cualquier User-Agent que contenga
 * la cadena "node", así que sus fotos nunca llegan al optimizador y las tarjetas pintaban
 * el degradado gris del tile: 65 de las 111 imágenes de la home.
 *
 * Lo que fija este test es **la decisión, no la foto**: qué hosts van por el proxy y
 * cuáles siguen al optimizador. Es una lista corta y medida, y su valor está en que un
 * cambio de lista se note: si mañana la entrada de La Genterula desaparece sin que nadie
 * mida el WAF otra vez, las 65 fotos vuelven a caerse y este test sigue en verde.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { debeUsarProxy, propsImagen, urlImagen } from "@/lib/image-proxy";

const ROOT = resolve(__dirname, "..");

const GENTERULA = "https://lagenterula.com/wp-content/uploads/2026/10/cartel.webp";
const GENTERULA_WWW = "https://www.lagenterula.com/wp-content/uploads/2026/10/cartel.webp";
const VITORIA = "https://www.vitoria-gasteiz.org/carteles/octubre.webp";
const DESCONOCIDO = "https://cdn.desconocido.example/cartel.jpg";

describe("debeUsarProxy", () => {
  it("La Genterula va por el proxy, con y sin www", () => {
    // Los dos hosts están porque conviven: el `www` de la lista es el del API MEC
    // (`rula.ts:1`) y el sin `www` el de `featured_image.large`, que es de donde salen
    // las fotos. Si solo se cubriera uno, la mitad de las tarjetas seguiría rota y esto
    // no se notaría.
    expect(debeUsarProxy(GENTERULA)).toBe(true);
    expect(debeUsarProxy(GENTERULA_WWW)).toBe(true);
  });

  it("no le importa cómo se escriba el host", () => {
    // El predicado se evalúa en cada tarjeta de la home, en el bundle del cliente. Una
    // comparación sensible a mayúsculas dejaría fuera de un día a la mitad de las fotos
    // según cómo las escribiera el scraper.
    expect(debeUsarProxy("https://LaGenterula.com/x.webp")).toBe(true);
    expect(debeUsarProxy("https://WWW.LAGENTERULA.COM/x.webp")).toBe(true);
  });

  it("los demás hosts siguen al optimizador, porque el proxy no les hace falta", () => {
    // Lo que no está en la lista son 25 hosts que sí funcionan. Mandarlos al proxy sería
    // perder el redimensionado y el AVIF/WebP a cambio de nada.
    expect(debeUsarProxy(VITORIA)).toBe(false);
    expect(debeUsarProxy("https://www.gasteizhoy.com/x.jpg")).toBe(false);
    expect(debeUsarProxy("https://res.cloudinary.com/x.jpg")).toBe(false);
  });

  it("un host que no está en la lista de imágenes no va al proxy tampoco", () => {
    // Las dos condiciones son distintas y las dos hacen falta: este host no se descarga
    // por ninguna de las dos rutas, así que mandarlo al proxy solo gastaría una petición.
    expect(debeUsarProxy(DESCONOCIDO)).toBe(false);
    expect(debeUsarProxy(undefined)).toBe(false);
    expect(debeUsarProxy(null)).toBe(false);
    expect(debeUsarProxy("")).toBe(false);
  });

  it("las rutas del propio sitio no van al proxy", () => {
    // El logo y los carteles locales no tienen host, y meterlos en un proxy sería un
    // salto extra a propósito.
    expect(debeUsarProxy("/logo.svg")).toBe(false);
    expect(debeUsarProxy("/carteles/octubre/portada.webp")).toBe(false);
    expect(debeUsarProxy("//lagenterula.com/x.webp")).toBe(false);
  });

  it("no se cuela un host que solo lleva el nombre en su ruta", () => {
    // El mismo cuidado que está en `imagenServible`, y por el mismo motivo: un
    // `includes` sobre la URL entera pondría en el proxy a cualquier sitio que aloje una
    // imagen con "lagenterula" en el nombre, que es un `fetch` a un host cualquiera.
    expect(debeUsarProxy("https://otro.example/lagenterula/cartel.jpg")).toBe(false);
    expect(debeUsarProxy("https://lagenterula.com.otro.example/x.webp")).toBe(false);
    expect(debeUsarProxy("https://malo-lagenterula.com/x.webp")).toBe(false);
  });
});

describe("urlImagen", () => {
  it("le pone el prefijo del proxy a La Genterula, y no a los demás", () => {
    // Lo que consume el `src` del `<Image>`. Que las dos formas se vean aquí, y no solo
    // como booleanos, es lo que fija el contrato con las trece tarjetas.
    expect(urlImagen(GENTERULA)).toBe(`/api/img?url=${encodeURIComponent(GENTERULA)}`);
    expect(urlImagen(VITORIA)).toBe(VITORIA);
  });

  it("codifica la URL entera en el parámetro", () => {
    // Sin `encodeURIComponent`, un `?` o un `#` de la URL del host parte el parámetro y
    // el proxy recibe una URL distinta de la que se le pidió.
    const conQuery = "https://lagenterula.com/x.jpg?w=100";
    expect(urlImagen(conQuery)).toBe(`/api/img?url=${encodeURIComponent(conQuery)}`);
  });

  it("lo que no se puede pintar sale como undefined, no como una URL rota", () => {
    // El contrato con las tarjetas es que `undefined` las hace caer en el degradado. Si
    // esto devolviera la URL tal cual, el `imagenServible` de cada caller se convertiría
    // en decorativo y volvería el crash que esa función existe para evitar.
    expect(urlImagen(DESCONOCIDO)).toBeUndefined();
    expect(urlImagen(undefined)).toBeUndefined();
    expect(urlImagen(null)).toBeUndefined();
    expect(urlImagen("//cdn.desconocido.example/x.jpg")).toBeUndefined();
  });

  it("las rutas del propio sitio salen sin tocar", () => {
    expect(urlImagen("/logo.svg")).toBe("/logo.svg");
  });
});

/**
 * El cableado: los sitios que pintan imágenes tienen que usar estas dos funciones.
 *
 * Es el mismo guard que el de `__tests__/image-hosts.test.ts`, con la misma forma y por
 * el mismo motivo —la lista de los trece ficheros está escrita, para que uno nuevo tenga
 * que decidir—, y por eso no se cuenta: un recuento no dice **cuáles** y no obliga a
 * nadie a mirar.
 *
 * Se mira `propsImagen(` con el paréntesis por la razón que ya está escrita en el otro
 * fichero: el `import` y el comentario bastarían para que un test buscara el nombre, que
 * es un test que pasa cuando lo que se ha roto es justo lo que tenía que comprobar.
 *
 * **Por qué `propsImagen` y no dos llamadas.** Un `<Image src={…} unoptimized={…}>`
 * escrito a mano en trece sitios es trece sitios donde se puede olvidar la segunda prop, y
 * olvidarla no pone la página en rojo: hace que la imagen vuelva a pasar por el
 * optimizador, que la pide a nuestro propio origen y la devuelve sin redimensionar. Es
 * un fallo silencioso que se ve en el peso de la imagen y en ningún log. `propsImagen`
 * devuelve las dos props juntas, y este test lo que comprueba es que nadie se los haya
 * repartido a mano.
 */
describe("propsImagen", () => {
  it("devuelve las dos props juntas, y eso es lo que impide el doble salto", () => {
    // `unoptimized` pegado a `src` a propósito. Un `<Image src="/api/img?url=…">` sin
    // `unoptimized` vuelve a pasar por el optimizador, que pide esa ruta a nuestro
    // propio origen y la devuelve sin redimensionar: no es un error rojo, es una imagen
    // que pesa lo que pesa el original. Aquí se ve en el contrato.
    expect(propsImagen(GENTERULA)).toEqual({
      src: `/api/img?url=${encodeURIComponent(GENTERULA)}`,
      unoptimized: true,
    });
  });

  it("los demás hosts van optimizados, como antes", () => {
    // Lo que no está en la lista de WAF son veinticinco hosts que funcionan, y mandarlos
    // al proxy sería perder el redimensionado y el AVIF/WebP a cambio de nada.
    expect(propsImagen(VITORIA)).toEqual({ src: VITORIA, unoptimized: false });
    expect(propsImagen("/logo.svg")).toEqual({ src: "/logo.svg", unoptimized: false });
  });

  it("lo que no se puede pintar sale como undefined, y no como unas props a medias", () => {
    // El contrato con las tarjetas: `undefined` es lo que las hace caer en el degradado.
    // Si esto devolviera un `src` sin comprobar, el `imagenServible` de cada caller
    // sería decorativo y volvería el crash que esa función existe para evitar.
    expect(propsImagen(DESCONOCIDO)).toBeUndefined();
    expect(propsImagen(undefined)).toBeUndefined();
    expect(propsImagen(null)).toBeUndefined();
    expect(propsImagen("//cdn.desconocido.example/x.jpg")).toBeUndefined();
  });

  it("codifica la URL entera en el parámetro", () => {
    // Sin `encodeURIComponent`, un `?` o un `#` de la URL del host parte el parámetro y
    // el proxy recibe una URL distinta de la que se le pidió.
    const conQuery = "https://lagenterula.com/x.jpg?w=100";
    expect(propsImagen(conQuery)?.src).toBe(`/api/img?url=${encodeURIComponent(conQuery)}`);
  });
});

describe("el proxy está cableado donde se pintan imágenes", () => {
  const SITIOS = [
    "app/components/ConciertosPageClient.tsx",
    "app/components/CulturePageClient.tsx",
    "app/components/GastronomiaPageClient.tsx",
    "app/components/Header.tsx",
    "app/components/HeroSearch.tsx",
    "app/components/KidsPageClient.tsx",
    "app/components/MovieCard.tsx",
    "app/components/NextDaysSection.tsx",
    "app/components/SectionsHub.tsx",
    "app/components/SportPageClient.tsx",
    "app/components/TopEventsSection.tsx",
    "app/evento/[slug]/page.tsx",
    "lib/shared.tsx",
  ];

  it("cada uno de los trece llama a `propsImagen`, y no se reparten las props a mano", () => {
    const sinCablear: string[] = [];

    for (const sitio of SITIOS) {
      const txt = readFileSync(join(ROOT, sitio), "utf8");
      // Fuera los comentarios de bloque, que en este repo son largos y citan la función
      // por nombre. Buscar el nombre sin el paréntesis daría verde con solo el `import`,
      // que es justo el fallo que este test tiene que ver.
      const codigo = txt.replace(/\/\*[\s\S]*?\*\//g, "");
      if (!codigo.includes("propsImagen(")) {
        sinCablear.push(sitio);
        continue;
      }
      // Y el otro sentido: un `unoptimized` escrito a mano junto a un `src` con
      // prefijo de `/api/img` es el doble salto. Si aparece en un fichero cableado, es
      // que alguien se ha saltado `propsImagen` para ese `<Image>`.
      if (/unoptimized=\{[^}]*debeUsarProxy/.test(codigo)) {
        sinCablear.push(`${sitio} (unoptimized a mano)`);
      }
    }

    expect(sinCablear).toEqual([]);
  });

  });