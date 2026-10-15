import { NextResponse } from "next/server";

import { esEvento, EVENTOS } from "@/lib/metricas";
import { anotar, porRuta, resumen } from "@/lib/metricas-store";

/**
 * Dónde se anotan las visitas y las instalaciones.
 *
 * `POST` es **pública** y `GET` **no**, y la asimetría es el diseño entero:
 *
 * - El `POST` lo llama el navegador desde un componente cliente, que no tiene
 *   `API_KEY` porque no se publica. Si exigiera la clave, cada visita
 *   devolvería 401 y el contador no subiría nunca — el mismo modo de fallo que ya
 *   llevaba un rato en `app/error.tsx` con los logs, y por eso `/api/log` está en
 *   `PUBLIC_API_ROUTES`.
 * - El `GET` es el panel, y el panel **no** va a estar abierto a internet. Aquí la
 *   clave se comprueba a mano porque el middleware ya pasó: una ruta que está en
 *   `PUBLIC_API_ROUTES` sale del middleware antes de mirar la clave, así que
 *   `/api/metric` tiene que comprobar ella misma lo que el middleware no comprueba.
 *
 * Lo que hace insecurizable un `POST` abierto no es la ruta sino el cuerpo: el
 * nombre tiene que estar en la lista cerrada de `lib/metricas.ts` y el tamaño lo
 * limita `MAX_CORPO_BYTES` aquí abajo. Un `string` libre sería un contador que
 * cualquiera infla, y un contador inflado es peor que no tener contador porque
 * nadie lo mira dos veces.
 */

/**
 * El techo del cuerpo. Un `POST` legítimo trae `{"evento":"visita","ts":1700…}`, o
 * sea unos cuarenta bytes; 1 KB es de sobra para el margen y corta de raíz el
 * corpo enorme que alguien podría mandar para meter filas.
 *
 * Mide en **bytes** y no en `String.length`, por lo mismo que `app/api/log`: un
 * emoji son dos unidades UTF-16, y un techo contado en unidades deja pasar el
 * doble de lo que dice.
 */
const MAX_CORPO_BYTES = 1024;

/**
 * La ruta, acotada.
 *
 * Sin este recorte el `POST` público podría mandar un `ruta` de un megabyte en
 * cada visita y la tabla —que crece sola— se llenaría de texto inútil. Y no es un
 * límite puramente teórico: el techo del **cuerpo** es de 1 KB, pero una fila por
 * visita multiplica ese 1 KB por todas las visitas que haya tenido el sitio.
 *
 * 200 es de sobra para cualquier ruta real del sitio, y el corte deja pasar
 * cualquier query string sin romper la vista por ruta.
 */
const MAX_RUTA_CHARS = 200;

function rutaDelCliente(bruto: unknown): string | null {
  if (typeof bruto !== "string") return null;
  const ruta = bruto.trim();
  if (ruta.length === 0) return null;
  return ruta.slice(0, MAX_RUTA_CHARS);
}

/** De dónde sale el reloj, y por qué no se usa el del servidor. */
function ahoraDelCliente(bruto: unknown, respaldo: number): number {
  if (typeof bruto !== "number" || !Number.isFinite(bruto)) return respaldo;
  /**
   * Se acota a una ventana razonable en lugar de creerle cualquier número.
   *
   * Sin este filtro, un `ts` de `1e18` pondría las filas en un futuro desde el
   * que la poda no las alcanza nunca, y un `ts` de `0` las borraría todas: es
   * decir, el `POST` público podría dejar la tabla vacía. La ventana es de una
   * hora por delante y media por detrás, que cubre un reloj de móvil desfasado
   * sin abrir la puerta a nada absurdo.
   */
  const ahora = Date.now();
  const margen = 60 * 60 * 1000;
  if (bruto > ahora + margen || bruto < ahora - margen) return ahora;
  return Math.floor(bruto);
}

export async function POST(req: Request) {
  const declarado = Number(req.headers.get("content-length"));
  if (Number.isFinite(declarado) && declarado > MAX_CORPO_BYTES) {
    return NextResponse.json({ error: "cuerpo demasiado grande" }, { status: 413 });
  }

  const cuerpo = await req.text();
  if (new TextEncoder().encode(cuerpo).length > MAX_CORPO_BYTES) {
    return NextResponse.json({ error: "cuerpo demasiado grande" }, { status: 413 });
  }

  let datos: { evento?: unknown; ts?: unknown; ruta?: unknown };
  try {
    datos = JSON.parse(cuerpo) as { evento?: unknown; ts?: unknown; ruta?: unknown };
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!esEvento(datos.evento)) {
    return NextResponse.json(
      { error: `evento desconocido`, permitidos: EVENTOS },
      { status: 400 }
    );
  }

  try {
    anotar(datos.evento, ahoraDelCliente(datos.ts, Date.now()), rutaDelCliente(datos.ruta) ?? undefined);
  } catch (err) {
    /**
     * Un 500 aquí no rompe nada de lo que el visitante está viendo — la anotación
     * se dispara desde un `useEffect` y su fallo se traga el navegador —, pero sí
     * dice en el log del servidor que la base no está escribiendo, que es el dato
     * que hace falta para saber que los contadores están mintiendo.
     */
    console.error("No se pudo anotar el evento", err);
    return NextResponse.json({ error: "no se pudo registrar" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * El panel: los recuentos, y solo con `x-api-key`.
 *
 * La comprobación está aquí y no en el middleware porque `/api/metric` está en
 * `PUBLIC_API_ROUTES` (lo necesita el `POST`), y una ruta que sale del middleware
 * nunca llega a la comprobación de clave. Con `GET` abierto, cualquiera que
 * adivinara la dirección vería cuántas personas entran; con la clave, hace falta
 * el mismo secreto que ya protege `/api/actividades/*`.
 *
 * Devuelve también `porRuta`, que es el desglose por página. Va en la misma
 * respuesta y no en otra ruta porque las dos se leen a la vez y separarlas
 * obligaría a dos `curl` para leer un embudo que cabe en una pantalla.
 */
export async function GET(req: Request) {
  const API_KEY = process.env.API_KEY;
  if (!API_KEY) {
    return NextResponse.json(
      { error: `API_KEY no está definida en el servidor` },
      { status: 503 }
    );
  }

  const key = req.headers.get("x-api-key");
  if (key !== API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ ...resumen(), porRuta: porRuta() });
}