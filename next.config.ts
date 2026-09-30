import type { NextConfig } from "next";

import { PUBLIC_API_ROUTES } from "./lib/api-public-routes";
import { REMOTE_PATTERNS } from "./lib/image-hosts";

/**
 * Cabeceras que van igual en todas las rutas de `/api`.
 *
 * `x-api-key` tiene que seguir aquí: sin ella en `Allow-Headers`, un cliente que
 * sí tiene la clave se come un error de CORS en el preflight y no puede llamar a
 * la API. `OPTIONS` también, por lo mismo.
 */
const CORS_COMUN = [
  { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
  { key: "Access-Control-Allow-Headers", value: "Content-Type, x-api-key" },
];

const nextConfig: NextConfig = {
  async headers() {
    // Sin origen configurado, las rutas protegidas se quedan sin
    // `Access-Control-Allow-Origin`: es lo más seguro, porque una cabecera que
    // no está no autoriza a nadie. Poner `*` «por si acaso» es justo el fallo
    // que se está arreglando.
    const origen = process.env.CORS_ORIGIN?.trim();

    return [
      /**
       * El orden importa y es el contrario del intuitivo.
       *
       * Next aplica **todas** las reglas cuyo `source` encaja y, para una clave
       * repetida, gana la última. Así que la general tiene que ir la primera: si
       * fuera después, su `Access-Control-Allow-Origin` machacaría el `*` de las
       * públicas y se romperían el buscador, las farmacias, el bus y el push.
       * Hay un test que fija esta posición.
       */
      {
        source: "/api/:path*",
        headers: origen
          ? [{ key: "Access-Control-Allow-Origin", value: origen }, ...CORS_COMUN]
          : CORS_COMUN,
      },

      // Una regla por ruta pública, con `source` exacto. Sin `:path*`: un
      // comodín de ruta aquí volvería a abrir `/api/cines/cualquier-cosa`, que
      // es el mismo error que el `startsWith` del middleware.
      ...PUBLIC_API_ROUTES.map((ruta) => ({
        source: ruta.path,
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }, ...CORS_COMUN],
      })),
    ];
  },
  images: {
    // Lista cerrada, medida sobre los scrapers y sobre los fixtures. Ver
    // `lib/image-hosts.ts` para de dónde sale cada host y para lo que no está y
    // por qué. Añadir uno es una decisión consciente, no una consecuencia.
    remotePatterns: REMOTE_PATTERNS,
  },
};

export default nextConfig;
