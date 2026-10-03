import { NextRequest, NextResponse } from "next/server";
import { sendToAll, type PushPayload } from "@/lib/push";
import { buildDailyDigest } from "@/lib/digest";

/** Lo que un service worker puede abrir en una pestaña o navegar. */
const MAX_URL = 300;

/** El origen contra el que se decide si una `url` es «de casa». */
function origenDelSitio(): string | null {
  const bruto = process.env.NEXT_PUBLIC_SITE_URL;
  if (!bruto) return null;
  try {
    return new URL(bruto).origin;
  } catch {
    return null;
  }
}

/**
 * Deja pasar solo rutas relativas del propio sitio y URLs absolutas del mismo
 * origen. Todo lo demás cae en `/`.
 *
 * Por qué: `public/sw.js:126,132` pasa este campo a `client.navigate(url)` y a
 * `clients.openWindow(url)` **sin mirar el origen**. Es el único campo del payload
 * que acaba siendo el destino de una navegación, así que es el único que decide si
 * la notificación manda a la gente a otro sitio. `title` y `body` se recortaban a
 * 120 y 300 caracteres; `url` no se recortaba ni se validaba, así que con la clave
 * de API —que es lo que pide el middleware para llegar aquí— un `{"url":
 * "https://otro.example/"}` mandaba a toda la lista de suscripciones fuera, con el
 * nombre del sitio en la notificación. Eso es phishing, no una URL rara.
 *
 * Los caminos que se cierran, y por qué:
 *
 * - `//otro.example/`: `startsWith("/")` lo deja pasar por un `startsWith` ingenuo y
 *   es protocol-relative, o sea que el navegador lo resuelve como absoluto.
 * - `/\otro.example/`: algunos navegadores lo tratan como `//`. Por eso se exige
 *   que no haya barra invertida, no que no haya barra.
 * - `javascript:` y `data:`: `new URL` los parsea sin quejarse, así que el filtro de
 *   protocolo no es opcional.
 * - Un origen distinto: el caso normal. `https://sitio.otro.example/` tiene el
 *   nombre del sitio al principio y no es el sitio.
 * - Credenciales en la URL: `https://a@sitio@otro.example/` se parsea con otro host.
 *   De ahí comparar el `origin` completo y no el `hostname`.
 */
export function urlSegura(crudo: unknown): string {
  if (typeof crudo !== "string") return "/";

  const recortada = crudo.trim().slice(0, MAX_URL);
  if (recortada === "") return "/";
  if (recortada.includes("\\")) return "/";

  // Una ruta del propio sitio: `/`, `/evento/x`, `/agenda?d=2026-10`. Sin protocolo
  // y sin `//` al principio no puede ser otra cosa.
  if (recortada.startsWith("/") && !recortada.startsWith("//")) return recortada;

  let parseada: URL;
  try {
    parseada = new URL(recortada);
  } catch {
    return "/";
  }

  if (parseada.protocol !== "https:" && parseada.protocol !== "http:") return "/";

  const origen = origenDelSitio();
  // Sin `NEXT_PUBLIC_SITE_URL` no hay contra qué comparar, y adivinar un origen
  // sería peor que no abrir nada: `/` siempre es del sitio.
  if (!origen || parseada.origin !== origen) return "/";

  return recortada;
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const hasCustom =
    typeof body.title === "string" && typeof body.body === "string";

  let payload: PushPayload;
  try {
    if (hasCustom) {
      payload = {
        title: (body.title as string).slice(0, 120),
        body: (body.body as string).slice(0, 300),
        url: urlSegura(body.url),
      };
    } else {
      payload = await buildDailyDigest();
    }

    const result = await sendToAll(payload);
    return NextResponse.json({ ok: true, payload, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error enviando push" },
      { status: 500 }
    );
  }
}
