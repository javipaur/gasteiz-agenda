import {
  isPublicApiRoute,
  PUBLIC_API_NAMESPACES,
  PUBLIC_API_ROUTES,
} from "@/lib/api-public-routes";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

/**
 * El paquete de redes tiene que ser público, y no es una COURTESÍA.
 *
 * Las direcciones que devuelve `GET /api/promo` son las que Meta descarga para
 * componer el post, y esa descarga **no lleva `x-api-key`**: es un `GET` de una URL
 * pública, hecho por un servidor de Meta que no tiene ni puede tener la clave de este
 * despliegue. Con `/api/promo` fuera de las exenciones, el middleware respondía 401 a
 * las tres rutas y el post salía publicado con un rectángulo vacío donde iba la
 * portada, sin ningún error en el servidor que lo explicara: para el despliegue, lo
 * único que había pasado era un `fetch` más.
 *
 * Y no puede estar en `PUBLIC_API_ROUTES`, que es de paths exactos: el `pathname` que
 * ve el middleware es `/api/promo/2026-10-07/portada`, con la fecha y el slug puestos,
 * y no hay forma de escribir eso en una lista de nombres fijos. Por eso existe
 * `PUBLIC_API_NAMESPACES`.
 */
describe("el paquete de redes es público", () => {
  it("las tres rutas con sus parámetros reales no piden clave", () => {
    for (const ruta of [
      "/api/promo",
      "/api/promo/2026-10-07/portada",
      "/api/promo/2026-10-07/evento/concierto-de-prueba",
    ]) {
      expect({ ruta, publica: isPublicApiRoute(ruta) }).toEqual({ ruta, publica: true });
    }
  });

  it("el middleware las deja pasar, que es lo que de nada sirve `isPublicApiRoute`", () => {
    // El predicado por sí solo no abre nada: lo que abre es la rama del middleware que
    // lo llama. Un test que solo mirara la función pasaría con el middleware roto.
    //
    // Y el criterio es `x-middleware-next: 1`, que es lo que `NextResponse.next()` pone
    // para decir "sigue con el enrutado normal", en vez de mirar el status: un 200 sin
    // esa cabecera sería una respuesta de verdad del route handler, no un paso de
    // largo. Es la misma comprobación que hace `__tests__/middleware.test.ts`.
    for (const ruta of ["/api/promo", "/api/promo/2026-10-07/portada"]) {
      const res = middleware(new NextRequest(new URL(ruta, "https://gasteizclick.test")));

      expect({ ruta, reenviada: res.headers.get("x-middleware-next") === "1" }).toEqual({
        ruta,
        reenviada: true,
      });
    }
  });

  it("sin la clave puesta, una ruta protegida responde 503 y el paquete no", () => {
    // La diferencia entre las dos ramas: una ruta protegida sin `API_KEY` en el entorno
    // contesta 503 —deployment roto, y lo dice—, y el paquete tiene que contestear sin
    // mirar la clave en absoluto. Si algún día alguien mete la comprobación en la
    // rama equivocada, esto se pone rojo.
    const res = middleware(new NextRequest(new URL("/api/promo", "https://gasteizclick.test")));

    expect(res.status).not.toBe(503);
    expect(res.status).not.toBe(401);
  });

  it("el espacio de nombres no se extiende a lo que le componga el nombre", () => {
    // El agujero del `startsWith` que `PUBLIC_API_ROUTES` cerró por escrito. Aquí el corte
    // lleva barra final, y este caso es el que lo comprueba: sin ella, `/api/promoXXX`
    // —y cualquier ruta que se añada mañana con el prefijo delante— nacería abierta.
    for (const ruta of ["/api/promocopia", "/api/promoxxx", "/api/promo2"]) {
      expect({ ruta, publica: isPublicApiRoute(ruta) }).toEqual({ ruta, publica: false });
    }
  });

  it("tolera la barra final, que Next no siempre normaliza antes del middleware", () => {
    expect(isPublicApiRoute("/api/promo/")).toBe(true);
    expect(isPublicApiRoute("/api/promo/2026-10-07/portada/")).toBe(true);
  });

  it("el espacio de nombres también lleva su motivo escrito", () => {
    // La misma regla que las de la lista exacta: la pregunta de una revisión no es
    // «¿está en la lista?» sino «¿por qué?».
    for (const entrada of PUBLIC_API_NAMESPACES) {
      expect(typeof entrada.motivo).toBe("string");
      expect(entrada.motivo.length).toBeGreaterThan(10);
    }
  });

  it("no se cuela nada de la lista de espacios en la de rutas exactas", () => {
    // Las dos listas se leen en sitios distintos —`middleware.test.ts` compara la
    // exacta contra una tabla suya— y una entrada en la que estuviera sería
    // invisible en uno de los dos lados.
    for (const entrada of PUBLIC_API_NAMESPACES) {
      expect(PUBLIC_API_ROUTES.some((r) => r.path === entrada.path)).toBe(false);
    }
  });
});