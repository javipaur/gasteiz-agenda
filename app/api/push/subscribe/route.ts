import { NextRequest, NextResponse } from "next/server";
import { addSubscription, removeSubscription } from "@/lib/push";

/**
 * Lo que acepta un push service real, y por qué hay un límite de tamaño.
 *
 * La validación anterior solo miraba el tipo y que el endpoint empezase por
 * `https://`. Como la ruta es pública —la necesita `PushNotifications` al pedir
 * permisos, y el navegador no tiene la clave— eso era una puerta abierta a
 * escribir sin autenticar y sin límite: un `endpoint` de 5 MB por `curl` repetido
 * llenaba `.data/push.db`, que `listSubscriptions()` carga entero en memoria en
 * cada digest.
 *
 * Los límites son del protocolo, no inventados: un endpoint de push service es una
 * URL https de un puñado de caracteres, y las claves son base64 de 65 y 16 bytes.
 * Lo que se valida es que no se salga de ese formato, y con él el destino de la
 * petición saliente queda acotado a un push service en vez de a cualquier URL
 * —`https://169.254.169.254/...` incluido—.
 */
const MAX_ENDPOINT = 512;
const MAX_CLAVE = 128;

const BASE64 = /^[A-Za-z0-9+/=_-]+$/;

function esClaveValida(valor: unknown): valor is string {
  return typeof valor === "string" && valor.length > 0 && valor.length <= MAX_CLAVE && BASE64.test(valor);
}

function esEndpointValido(valor: unknown): valor is string {
  if (typeof valor !== "string") return false;
  if (valor.length === 0 || valor.length > MAX_ENDPOINT) return false;
  if (!valor.startsWith("https://")) return false;

  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    return false;
  }

  const host = url.hostname.toLowerCase();
  if (host.length === 0) return false;

  // Sin esto, `https://169.254.169.254/latest/meta-data/…` pasaba el
  // `startsWith("https://")` de antes, y cada fila guardada se convertía en una
  // petición HTTPS saliente a la IP de metadatos de la instancia. No se puede
  // listar los push services de verdad —Firefox, Chrome, Safari y Windows usan
  // hosts distintos, y los autoalojados existen—, pero sí se pueden negar las
  // redes que nunca son un push service y siempre son un objetivo.
  if (host === "localhost" || host.endsWith(".localhost")) return false;
  if (host === "::1" || host === "[::1]" || host === "0.0.0.0" || host === "[::]") return false;

  // Un host que es una IP literal. Se parsea para no tener que distinguir
  // `10.0.0.1` de un dominio que empieza por `10.`: `URL` normaliza IPv6 a
  // corchetes, y por eso se quitan antes de mirar los grupos.
  const ipv6 = host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : null;
  if (ipv6) return !esIpPrivada(ipv6, true);
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return !esIpPrivada(host, false);

  // Un dominio normal: tiene que parecer un dominio, no cualquier cosa.
  return host.includes(".") && !/^[.-]|[.-]$/.test(host);
}

/** Si una IP es loopback, link-local, privada o sinilsonido. */
function esIpPrivada(ip: string, esIpv6: boolean): boolean {
  if (esIpv6) {
    const normalizada = ip.toLowerCase();
    // fe80::/10 link-local, fc00::/7 unicast privado, y ::ffff: mapped.
    if (normalizada.startsWith("fe8") || normalizada.startsWith("fe9") || normalizada.startsWith("fea") || normalizada.startsWith("feb")) return true;
    if (normalizada.startsWith("fc") || normalizada.startsWith("fd")) return true;
    return normalizada.startsWith("::ffff:");
  }
  const [a, b] = ip.split(".").map(Number);
  if (a === 127 || a === 0) return true;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

function isValidSubscription(body: unknown): body is {
  endpoint: string;
  keys: { p256dh: string; auth: string };
} {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  const keys = b.keys as Record<string, unknown> | undefined;
  return esEndpointValido(b.endpoint) && esClaveValida(keys?.p256dh) && esClaveValida(keys?.auth);
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!isValidSubscription(body)) {
    return NextResponse.json(
      { error: "Suscripción inválida" },
      { status: 400 }
    );
  }

  await addSubscription({
    endpoint: body.endpoint,
    keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
    addedAt: Date.now(),
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const endpoint =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>).endpoint
      : undefined;

  // La misma validación que el alta, y por el mismo motivo. Antes solo se
  // comprobaba que fuera una string, así que **borrar la suscripción de otra
  // persona era público** para quien conociera su endpoint —y con
  // `Access-Control-Allow-Origin: *`, desde cualquier origen.
  if (!esEndpointValido(endpoint)) {
    return NextResponse.json({ error: "Endpoint inválido" }, { status: 400 });
  }

  await removeSubscription(endpoint);
  return NextResponse.json({ ok: true });
}
