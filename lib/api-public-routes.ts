/**
 * Las rutas de `/api/*` que responden sin `x-api-key`, y solo esas.
 *
 * El módulo es una hoja pura: no importa nada a propósito. Lo leen tres sitios
 * —el middleware, la CORS de `next.config.ts` y el test que contrasta
 * `public/openapi.yaml`— y si viviera junto a los scrapers, la CORS arrastraría
 * `cheerio` al grafo de build por el mismo camino que lo arrastró
 * `lib/utils.ts` en su día.
 *
 * ## Por qué una lista y no una regla
 *
 * La versión anterior era `PUBLIC_API_ROUTES.some((r) => pathname.startsWith(r))`
 * con `"/api/actividades"` dentro. Eso no era «una ruta pública»: era un prefijo,
 * y un prefijo abre todo lo que cae en él, incluido lo que se añada mañana. Con
 * la lista exacta, abrir una ruta es escribir su nombre.
 *
 * ## Por qué la lista lleva `motivo`
 *
 * Porque la pregunta que se hace en una revisión no es «¿está en la lista?» sino
 * «¿por qué está en la lista?». Una entrada sin motivo escrito es una entrada
 * que nadie va a volver a mirar, y `__tests__/middleware.test.ts` la exige.
 *
 * ## Por qué hay dos listas
 *
 * `PUBLIC_API_ROUTES` es de paths exactos. `PUBLIC_API_NAMESPACES` es para lo que
 * lleva parámetros en el path y no se puede escribir exacto; hoy solo la tiene
 * `/api/promo`, y el motivo de cada una está escrito en su sitio.
 */

/** Una exención de autenticación, con el motivo por el que existe. */
export type PublicApiRoute = {
  /** Ruta exacta, tal cual aparece en el `pathname` de Next. */
  readonly path: string;
  /** Por qué no puede exigir `API_KEY`. Una frase, y que siga siendo cierta. */
  readonly motivo: string;
};

/**
 * Rutas públicas. Exactas: sin comodines, sin prefijos.
 *
 * Criterio: o las llama el navegador desde un componente cliente —que no tiene la
 * clave y no puede obtenerla—, o son un enlace que el usuario abre desde un
 * cliente de correo, o están documentadas para clientes externos en
 * `public/openapi.yaml`.
 */
export const PUBLIC_API_ROUTES: readonly PublicApiRoute[] = [
  // Las llama el navegador. El cliente no puede mandar `x-api-key` porque la
  // clave no se publica, así que exigirlas rompería la web.
  {
    path: "/api/farmacias",
    motivo: "la llama FarmaciasPageClient desde el navegador",
  },
  {
    path: "/api/push/subscribe",
    motivo: "la llama PushNotifications al pedir permisos",
  },
  {
    path: "/api/search",
    motivo: "la llaman Header y HeroSearch",
  },
  {
    path: "/api/vgbus",
    motivo: "la llama BusPageClient",
  },

  // El logger del navegador. `lib/axiom/client.ts` monta
  // `SimpleFetchTransport({input: "/api/log"})` desde un módulo `"use client"`, que
  // consume `app/error.tsx`. El navegador no publica `API_KEY` y no puede mandarla,
  // así que con esta ruta fuera de la lista el middleware respondía 401 y **todos
  // los `console.warn` del cliente se descartaban en silencio**: el aviso se perdía
  // justo en la página de error, que es donde más hace falta verlo.
  //
  // Es la única exención de la lista que se traga de cualquiera lo que mande, así
  // que el techo de tamaño del cuerpo lo pone la ruta (`app/api/log/route.ts`) y no
  // el middleware. Con la CORS abierta que llevan las públicas, quien puede escribir
  // aquí es cualquier `<script>` de cualquier página.
  {
    path: "/api/log",
    motivo:
      "el logger del navegador no tiene la clave y sin esto sus avisos se pierden",
  },

  // El newsletter. El alta viene del formulario, y confirmar y darse de baja son
  // enlaces que se abren en el navegador del destinatario desde su cliente de
  // correo: no hay componente cliente al que colgarles la clave.
  {
    path: "/api/newsletter/subscribe",
    motivo: "alta desde el formulario del navegador",
  },
  {
    path: "/api/newsletter/confirm",
    motivo: "enlace de confirmación que llega por email",
  },
  {
    path: "/api/newsletter/unsubscribe",
    motivo: "enlace de baja que llega por email",
  },

  // El estado del agregado. Es pública porque su consumidor natural es un motor de
  // búsqueda o una IA que se conecta desde fuera y no tiene la clave, que es
  // justo a quien le sirve: poder comprobar si los datos son completos antes de
  // contestarle a alguien. La ruta solo lee la caché `agenda-all-v2`, así que no
  // dispara scraping; el trabajo ya está hecho cuando alguien carga la home.
  {
    path: "/api/v1/salud",
    motivo:
      "un cliente externo necesita poder comprobar si la agenda esta completa antes de usarla",
  },

  // Las cines, una a una. `/api/cines` es la lista y las otras dos son las
  // carteleras; el OpenAPI las publica para clientes móviles, que no tienen la
  // clave. Se escriben las tres en vez de dejar `/api/cines` como prefijo
  // porque un prefijo abriría también `/api/cines/cualquier-cosa-nueva`.
  {
    path: "/api/cines",
    motivo: "documentada en openapi.yaml para apps móviles",
  },
  {
    path: "/api/cines/boulevard",
    motivo: "documentada en openapi.yaml para apps móviles",
  },
  {
    path: "/api/cines/florida",
    motivo: "documentada en openapi.yaml para apps móviles",
  },
];

/**
 * Espacios de nombres públicos: todo lo que caiga debajo es público.
 *
 * **La lista de arriba es de paths exactos y estas no pueden estar en ella.** Las tres
 * rutas del paquete de redes llevan la fecha y el slug en el path
 * (`/api/promo/2026-10-07/portada`), así que el path literal que Next conoce —el del
 * fichero, con `[fecha]`— no es el `pathname` que llega al middleware. Una lista exacta
 * no puede hacerlos públicos, y sin esto el middleware responde 401 a las direcciones
 * que el propio paquete devuelve: **la imagen que va al post de Instagram sale con un
 * hueco**, porque Meta la descarga sin ninguna credencial y no reintenta con una clave
 * que no existe.
 *
 * **Por qué un espacio de nombres no es aquí el agujero del `startsWith`.** El
 * problema de `/api/actividades` era que un prefijo abría lo que se añadiera mañana sin
 * que nadie lo decidiera. `/api/promo` no tiene esa forma: las tres rutas que hay
 * debajo son públicas **por diseño**, todas sirven material para publicar y ninguna
 * escribe ni toca una credencial. Lo que se protege en este repo es lo que lee o
 * muta datos de la agenda; el paquete solo lee. Aun así el corte lleva barra final, para
 * que `/api/promoXXX` no entre por accidente.
 */
export const PUBLIC_API_NAMESPACES: readonly PublicApiRoute[] = [
  {
    path: "/api/promo",
    motivo:
      "las imagenes las descarga Meta sin credencial, asi que el paquete tiene que ser publico",
  },
];

const PUBLICAS = new Set(PUBLIC_API_ROUTES.map((r) => r.path));

/**
 * Las raíces de los espacios de nombres, sin barra.
 *
 * La comparación de abajo usa la barra puesta en el momento de comparar, y no aquí,
 * porque hacen falta las dos formas: `/api/promo` es el propio espacio de nombres y
 * `/api/promo/2026-10-07/portada` está debajo. Con una sola de las dos, el paquete
 * sería público por la mitad.
 */
const ESPACIOS = PUBLIC_API_NAMESPACES.map((r) => r.path);

/**
 * `true` si la ruta es pública.
 *
 * Se normaliza la barra final porque Next no la quita antes de invocar el
 * middleware: `/api/search/` y `/api/search` son la misma ruta para quien
 * navega. Lo demás se compara exacto, sin `startsWith` y sin mirar mayúsculas:
 * `/API/SEARCH` es otra ruta, y una que no existe.
 */
export function isPublicApiRoute(pathname: string): boolean {
  const normalizada =
    pathname.length > 1 && pathname.endsWith("/") ? pathname.replace(/\/+$/, "") : pathname;
  // La lista exacta va primero: es el camino normal y no depende de ningún prefijo.
  if (PUBLICAS.has(normalizada)) return true;
  // Y el espacio de nombres se comprueba contra su barra final puesta, por lo que solo
  // entra lo que está debajo de él y no lo que le componga el nombre al lado: con
  // `startsWith("/api/promo")` sin más, `/api/promocopia` nacería pública.
  return ESPACIOS.some((raiz) => normalizada === raiz || normalizada.startsWith(`${raiz}/`));
}
