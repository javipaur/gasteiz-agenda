import { NextRequest, NextResponse } from "next/server";

import { isPublicApiRoute } from "@/lib/api-public-routes";

const API_KEY = process.env.API_KEY;

const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 100;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function getRateLimitHeaders(key: string) {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return {
      "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
      "X-RateLimit-Remaining": String(RATE_LIMIT_MAX - 1),
      "X-RateLimit-Reset": String(Math.ceil((now + RATE_LIMIT_WINDOW) / 1000)),
    };
  }

  entry.count++;
  const remaining = Math.max(0, RATE_LIMIT_MAX - entry.count);
  return {
    "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.ceil(entry.resetAt / 1000)),
  };
}

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) return false;
  return entry.count >= RATE_LIMIT_MAX;
}

function cleanupRateLimit() {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}

let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 5 * 60_000;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  if (isPublicApiRoute(pathname)) {
    return NextResponse.next();
  }

  /*
   * El preflight de CORS no puede llevar la clave, y aquí se le pedía.
   *
   * Un `OPTIONS` de preflight lleva `Origin`, `Access-Control-Request-Method` y
   * `Access-Control-Request-Headers`. No lleva `x-api-key` ni `?api_key=`, y no
   * puede: el navegador aún no ha enviado la petición real, así que no tiene dónde
   * ponerlos. Lo único que se podía comprobar era la clave, así que todo preflight
   * a una ruta protegida caía en el 401 de la línea de abajo. Para el navegador eso
   * no es un 401, es un error de CORS: **la petición real ni se intentaba**. O sea
   * que ninguna ruta protegida de `/api/*` era callable desde un navegador de otro
   * origen, que es justo para lo que `CORS_ORIGIN` está documentado en el README.
   *
   * La culpa era compartida con `next.config.ts`, que sí pone `x-api-key` en
   * `Access-Control-Allow-Headers` con el motivo escrito en el fichero: sin esa
   * cabecera el preflight falla. Estaba todo medio hecho menos en el sitio donde no
   * se podía arreglar desde el navegador.
   *
   * Se devuelve `next()` y no una respuesta hecha aquí a propósito: las cabeceras
   * de CORS las pone `next.config.ts` y no hay que mantener dos reglas de origen,
   * y el route handler que no exporta `OPTIONS` lo implementa Next solo, con un 204
   * y su `Allow`. Lo único que hace este bloque es **no exigir la clave** a algo
   * que por definición no la puede traer.
   *
   * El alcance es `OPTIONS` y solo `OPTIONS`. Relajar el resto sería devolver la
   * autenticación a la categoría de sugerencia, que es de donde salió.
   *
   * Va **después** de `isPublicApiRoute` y no antes: una ruta pública ya ha
   * contestado, así que preguntarle por el método sería trabajo para nada.
   */
  if (request.method === "OPTIONS") {
    return NextResponse.next();
  }

  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  /*
   * Fail-closed, y deliberadamente ruidoso.
   *
   * Aquí antes había un `console.warn("API_KEY not set – API endpoints are open")`
   * y un `NextResponse.next()`: sin `API_KEY` en el entorno, *toda* la API
   * contestaba sin autenticar. El aviso era una línea en un log de arranque que
   * nadie lee, y su efecto era el contrario del que el mensaje pedía: no era
   * «no he configurado esto», era «lo he abierto».
   *
   * Un despliegue con `API_KEY` sin definir no está en modo degradado, está roto,
   * y tiene que decírselo a quien llama con un 503 que menciona la variable. La
   * alternativa —abrir y avisar— convierte un error de configuración en una fuga,
   * y la fuga no sale en ningún log del servidor: sale en la factura de quien
   * hostea la API.
   *
   * Esto solo afecta a las rutas protegidas: las de `PUBLIC_API_ROUTES` han
   * vuelto antes y siguen funcionando sin clave, que es lo que necesitan para
   * que la web cargue.
   */
  if (!API_KEY) {
    return NextResponse.json(
      {
        error:
          "Service misconfigured – API_KEY is not set on the server, so protected endpoints are closed",
      },
      { status: 503 }
    );
  }

  const key =
    request.headers.get("x-api-key") ??
    request.nextUrl.searchParams.get("api_key");

  if (!key || key !== API_KEY) {
    return NextResponse.json(
      {
        error:
          "Unauthorized – provide a valid x-api-key header or ?api_key= query param",
      },
      { status: 401 }
    );
  }

  const now = Date.now();
  if (now - lastCleanup > CLEANUP_INTERVAL) {
    cleanupRateLimit();
    lastCleanup = now;
  }

  if (isRateLimited(clientIp)) {
    const entry = rateLimitMap.get(clientIp)!;
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          ...getRateLimitHeaders(clientIp),
        },
      }
    );
  }

  const response = NextResponse.next();
  const rateLimitHeaders = getRateLimitHeaders(clientIp);
  for (const [k, v] of Object.entries(rateLimitHeaders)) {
    response.headers.set(k, v);
  }
  setCacheHeaders(response, pathname);
  return response;
}

/**
 * Las tres rutas de cines, escritas una a una.
 *
 * Concreto y no un prefijo por el mismo motivo que en `lib/api-public-routes.ts`:
 * `startsWith("/api/cines")` metería dentro de la caché de una hora también
 * `/api/cines-copia` y cualquier `/api/cines/lo-que-venga`. Una lista de tres
 * elementos que hay que actualizar a mano es más barata de revisar que un patrón
 * que acepta lo que caiga.
 */
const CINES = new Set(["/api/cines", "/api/cines/boulevard", "/api/cines/florida"]);

const CACHE_CINCO_MINUTOS = "public, s-maxage=300, stale-while-revalidate=600";
const CACHE_UN_DIA = "public, s-maxage=3600, stale-while-revalidate=7200";

/**
 * El `Cache-Control` de una ruta de `/api`, según la ruta exacta.
 *
 * Estaba escrito como `pathname.startsWith("/api/cines/")`, **con la barra final**,
 * así que `/api/cines` —la lista de salas del sitio— no casaba y se iba al `else`
 * de cinco minutos. Las tres rutas declaran `export const revalidate = 3600` y
 * `getPeliculas` cachea cinco minutos: tres declaraciones de frescura para la misma
 * respuesta, y ganaba la que no coincidía con el prefijo.
 *
 * Se exporta para poder probarla sola, y porque `setCacheHeaders` no puede: hoy las
 * tres rutas de cines son **públicas**, así que `isPublicApiRoute` las devuelve
 * antes de llegar aquí y la rama solo se alcanzaría si alguna se protegiera mañana.
 * Lo que se fija es la política, no un efecto que ahora mismo no se da.
 */
export function cacheControlDe(pathname: string): string {
  const ruta =
    pathname.length > 1 && pathname.endsWith("/") ? pathname.replace(/\/+$/, "") : pathname;
  if (CINES.has(ruta)) return CACHE_UN_DIA;
  return CACHE_CINCO_MINUTOS;
}

function setCacheHeaders(response: NextResponse, pathname: string) {
  // `/api/v1/*` es un prefijo a propósito y no un error como el de cines: es un
  // espacio de nombres entero con la misma forma de respuesta, y todas sus rutas
  // son del mismo cliente móvil.
  const cache = pathname.startsWith("/api/v1/")
    ? CACHE_CINCO_MINUTOS
    : cacheControlDe(pathname);
  response.headers.set("Cache-Control", cache);
}

export const config = {
  matcher: "/api/:path*",
};
