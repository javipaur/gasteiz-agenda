import { NextResponse } from "next/server";
import { logger } from "@/lib/axiom/server";
import { createProxyRouteHandler } from "@axiomhq/nextjs";

const proxy = createProxyRouteHandler(logger);

/**
 * Cuánto se acepta en un `POST` a `/api/log`.
 *
 * 16 KB. Un `console.warn` con su contexto de React ocupa del orden de un kilobyte,
 * así que de sobra para el uso real —el `autoFlush` agrupa varios en uno— y muy
 * por debajo de lo que hace falta para amplificar nada. La cifra va con el resto de
 * la validación en `app/api/push/subscribe`, que también es pública y también mide.
 */
const MAX_BODY_BYTES = 16 * 1024;

function demasiadoGrande(cuerpo: string): boolean {
  // En bytes, no en `String.length`: un emoji son dos unidades UTF-16, así que un
  // techo contado con `length` deja pasar el doble de lo que dice.
  return new TextEncoder().encode(cuerpo).length > MAX_BODY_BYTES;
}

export async function POST(req: Request) {
  // El `content-length` se mira primero solo para no tirar un cuerpo enorme a
  // memoria si el cliente dice la verdad. No es en lo que se confía: se mide
  // después, porque es una cabecera que envía el cliente.
  const declarado = Number(req.headers.get("content-length"));
  if (Number.isFinite(declarado) && declarado > MAX_BODY_BYTES) {
    return cuerpoDemasiadoGrande();
  }

  const cuerpo = await req.text();
  if (demasiadoGrande(cuerpo)) {
    return cuerpoDemasiadoGrande();
  }

  /**
   * El proxy recibe una `Request` nueva con el cuerpo ya leído, y no el original.
   *
   * Es lo que hace posible medir antes de delegar: una vez que el cuerpo está en
   * memoria, se reconstruye la petición con él. Se copia la cabecera menos
   * `content-length` porque la de la nueva la calcula el runtime, y dejarla puesta
   * sería un `content-length` que ya no corresponde con el cuerpo.
   *
   * El texto se pasa tal cual, sin decodificar ni re-codificar: si el proxy recibiera
   * otra cosa, a Axiom le llegaría otro log.
   */
  const cabeceras = new Headers(req.headers);
  cabeceras.delete("content-length");

  return proxy(
    new Request(req.url, { method: "POST", headers: cabeceras, body: cuerpo })
  );
}

function cuerpoDemasiadoGrande() {
  return NextResponse.json(
    {
      error: `Cuerpo demasiado grande – /api/log acepta hasta ${MAX_BODY_BYTES} bytes, que es de sobra para los avisos del navegador`,
    },
    { status: 413 }
  );
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
