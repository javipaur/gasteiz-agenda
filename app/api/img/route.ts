/**
 * El proxy de imágenes de los hosts que rechazan al optimizador de Next.
 *
 * **Por qué existe esta ruta.** El optimizador de `next/image` manda cabeceras fijas
 * —`BASE_REQ_HEADERS` en `image-optimizer.js`, con `user-agent: node` escrito a fuego— y
 * no hay ninguna opción de `next.config.ts` para cambiarlas. La Genterula tiene un WAF
 * que **403 a cualquier User-Agent que contenga la cadena "node"**, así que sus fotos no
 * llegan nunca al optimizador y las tarjetas pintaban el degradado gris del tile: 65 de
 * las 111 imágenes de la home, medido el 7 de octubre de 2026.
 *
 * Que se use `imagenServible` y no una copia de la lista es la mitad del motivo: un
 * proxy de imágenes sin lista blanca es un amplificador de tráfico contra terceros, que
 * es justo lo que `lib/image-hosts.ts` cerró el 30 de septiembre. Y si mañana un host
 * entra en la lista, entra aquí sin que nadie tenga que acordarse.
 */
import { imagenServible } from "@/lib/image-hosts";

export const runtime = "nodejs";

/**
 * Un User-Agent de navegador, y por qué está escrito y no se deja el de undici.
 *
 * La Genterula bloquea la cadena "node" y el UA por defecto de undici es precisamente
 * `node`. Cualquier valor sin "node" devuelve 200, medido contra el sitio en vivo el 7
 * de octubre de 2026, tres peticiones por valor: `node` y `Node.js` daron 403 los seis,
 * y `undici/7`, `curl/8`, `Mozilla/5.0` y sin UA dieron 200 los doce.
 *
 * Se escribe uno explícito y estable en vez de dejar que cada petición decida: si
 * mañana undici cambia su UA por defecto, esta ruta sigue funcionando sin tocar nada.
 * La versión de Chrome es la última que se sabe publicada; no necesita ser creíble,
 * solo no ser "node".
 */
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

/**
 * El tiempo que se espera a un host que puede estar caído.
 *
 * Sin él, una imagen colgada retiene la respuesta hasta que el navegador agota su
 * propio tiempo, y una tarjeta que no aparece es peor que una que degrada al tile.
 */
const TIEMPO_LIMITE_MS = 7000;

/**
 * Lo que se acepta como "una imagen".
 *
 * `next/image` solo devuelve estos cinco y saberlo aquí evita que un host conteste con
 * un 200 y algo que no es una imagen: el navegador recibiría una "imagen" que no lo es y
 * la tarjeta se quedaría en el degradado sin dejar nada en el log.
 */
const TIPOS_PERMITIDOS = new Set([
  "image/webp",
  "image/jpeg",
  "image/png",
  "image/avif",
  "image/gif",
]);

export async function GET(req: Request) {
  const upstream = new URL(req.url).searchParams.get("url");

  // Un host fuera de la lista es un 400 y no un 403: no es un problema de permisos con
  // ese host, es que ese host no está. Las rutas del propio sitio tampoco pasan: el logo
  // no necesita un proxy, y `imagenServible` las acepta solo para que el logo se pinte.
  if (!imagenServible(upstream) || upstream.startsWith("/")) {
    return new Response(null, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(upstream, {
      headers: { "User-Agent": USER_AGENT, Accept: "image/*,*/*;q=0.8" },
      signal: AbortSignal.timeout(TIEMPO_LIMITE_MS),
      // `manual` y no seguir: un redirect a otro host saltaría la lista blanca, que es
      // exactamente la puerta que este proxy cierra. Un host que redirige se queda sin
      // imagen, que es el degradado que el sitio ya sabe pintar.
      redirect: "manual",
    });
  } catch {
    // Un timeout o un fallo de red del host es un 502 y no una excepción: la tarjeta
    // degrada al tile. Si esto escalara, una sola imagen con el host caído tumbaría las
    // páginas que la pintan, que es lo que `imagenServible` existe para que no pase.
    return new Response(null, { status: 502 });
  }

  // Un 3xx con `redirect: "manual"` es un host al que esta ruta no puede responder: con
  // `follow` el proxy descargaría de cualquier sitio —la puerta que cierra— y propagar el
  // `Location` tampoco vale, porque el navegador lo seguiría igual y la imagen se pintaría
  // desde un host que no está en la lista. Degrada, que es lo que el sitio sabe pintar.
  if (res.status >= 300 && res.status < 400) {
    return new Response(null, { status: 502 });
  }

  // Se propaga el estado del host y no se convierte en un 200 con el cuerpo vacío: un
  // 403 tiene que verse como 403, o la tarjeta queda en un estado que no distingue "no
  // hay foto" de "el host está caído".
  if (!res.ok) {
    return new Response(null, { status: res.status });
  }

  const tipo = res.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
  if (!TIPOS_PERMITIDOS.has(tipo)) {
    return new Response(null, { status: 400 });
  }

  // El `Cache-Control` del origen se propaga cuando lo trae, y si no, un día. Una
  // cartelera es un dato que cambia una vez al día: revalidar más veces que eso solo
  // gasta peticiones a un tercero.
  return new Response(res.body, {
    status: 200,
    headers: {
      "Content-Type": tipo,
      "Cache-Control": res.headers.get("cache-control") ?? "public, max-age=86400",
    },
  });
}