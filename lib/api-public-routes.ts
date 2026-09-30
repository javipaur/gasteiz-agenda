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

const PUBLICAS = new Set(PUBLIC_API_ROUTES.map((r) => r.path));

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
  return PUBLICAS.has(normalizada);
}
