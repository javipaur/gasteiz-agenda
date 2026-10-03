import { NextResponse } from "next/server";
import { addSubscriber, getAllSubscribers } from "@/lib/db";
import { sendConfirmationEmail } from "@/lib/email";

const MIN_FORM_TIME_MS = 3000;
const RATE_WINDOW_MS = 10 * 60_000;
const RATE_MAX_PER_EMAIL = 5;
const RATE_MAX_PER_IP = 20;

/**
 * Cuántas claves de rate limit caben en el mapa antes de echar las viejas.
 *
 * Es un tope, no un intervalo, y hace falta el otro mecanismo: la limpieza
 * periódica acota el promedio, no el pico. Un bot puede crear todas las claves
 * que quiera entre dos limpiezas, así que el número de entradas vive por debajo
 * de este tope en cualquier momento.
 */
const RATE_MAX_CLAVES = 1000;

/** Cada cuánto se barren las claves que ya no pueden bloquear a nadie. */
const CLEANUP_INTERVAL_MS = 5 * 60_000;

const rateAttempts = new Map<string, number[]>();
let lastCleanup = Date.now();

/**
 * Con qué cadena se guarda la fila, y por qué no basta con `toLowerCase()`.
 *
 * `addSubscriber` busca con `s.email === email`, o sea comparación exacta
 * (`lib/db.ts`). Sin normalizar, `Gasteiz.Click@gmail.com` y
 * `gasteiz.click@gmail.com` son dos suscriptores distintos: dos filas activas,
 * dos tokens de baja distintos, y `removeSubscriber` —que busca por token— solo
 * apaga una. La otra sigue recibiendo la agenda después de que la persona se dé
 * de baja, y el argumento de que «el token es lo único que protege a un
 * suscriptor de que lo den de baja» se queda roto justo en el caso que
 * existía para protegerlo.
 *
 * **Normalizar solo el alta no lo arregla, y crea el duplicado donde no lo
 * había.** La fila que ya está en el fichero puede tener la capitalización
 * antigua: si el alta de hoy normaliza a `gasteiz.click@…` y la fila guardada
 * dice `Gasteiz.Click@…`, la comparación exacta no la encuentra y el arreglo
 * multiplica por dos el buzón justo cuando lo estamos intentando evitar. Por eso
 * aquí no se normaliza a ciegas: se busca el buzón en el fichero sin mirar las
 * mayúsculas y, si está, se le pasa a `addSubscriber` **la cadena que hay
 * guardada**, no la que escribió la persona —que puede no coincidir carácter a
 * carácter, porque `Gasteiz.Click@` y `GASTEIZ.CLICK@` son el mismo buzón y
 * solo una de las dos es la fila—.
 *
 * Así el alta y la re-alta casan siempre, y toda fila nueva se guarda ya
 * normalizada para que las siguientes comparaciones también. Lo que no hace
 * esto es fusionar duplicados que ya estén en el fichero: son dos filas con dos
 * tokens y borrar una es cosa de `lib/db.ts`, no de la ruta.
 */
function correoParaGuardar(email: string): string {
  const normalizado = email.toLowerCase();
  const guardada = getAllSubscribers().find(
    (s) => s.email.trim().toLowerCase() === normalizado
  );
  return guardada ? guardada.email : normalizado;
}

/**
 * Barren las claves cuyo último sello está fuera de la ventana.
 *
 * El filtro de `isRateLimited` quita los sellos viejos de una clave, pero no
 * borra la clave: se quedaba en el mapa para siempre, con su array. Y el mapa
 * vive en el módulo, así que no se vacía nunca salvo que el proceso arranque otra
 * vez, que en Dokploy es un redeploy. Un bot que rote 100 000 correos distintos
 * deja 100 000 entradas en el heap, cada una con su array.
 *
 * Solo se miran las claves cuyo **último** sello está caducado: mientras una
 * clave tenga un intento dentro de la ventana sigue bloqueando a alguien, y
 * borrarla antes de tiempo dejaría pasar a quien está abusando de verdad.
 */
function limpiarRateAttempts(now: number) {
  for (const [clave, sellos] of rateAttempts) {
    const ultimo = sellos[sellos.length - 1];
    if (ultimo === undefined || now - ultimo >= RATE_WINDOW_MS) {
      rateAttempts.delete(clave);
    }
  }
}

/**
 * Echa las claves más antiguas cuando el mapa se pasa del tope.
 *
 * Se echan las que llevan más tiempo sin usarse, que son las que antes o después
 * se van a cadencear solas: es el orden que menos molesta. Se hace aquí, en cada
 * intento, y no solo dentro de la pasada de limpieza, porque el intervalo no
 * acota el pico y el pico es justo lo que tumba el proceso.
 *
 * Lo que se pierde al expulsar es el historial de intentos de una clave, no un
 * dato de nadie: con la avalancha encima, un suscriptor legítimo puede colarse
 * en un intento más de los cinco por diez minutos. El otro lado de no hacerlo es
 * que las 100 000 claves se quedan todas, y mil claves es holgado para un sitio
 * con unos cuantos cientos de suscriptores.
 */
function expulsarSiHayDemasiadas() {
  if (rateAttempts.size <= RATE_MAX_CLAVES) return;

  // El último sello es el más reciente: se empujan en orden y el filtro los
  // conserva, así que por el final de cada array se ordena por antigüedad de la
  // última vez que se vio esa clave.
  const porAntiguedad = [...rateAttempts].sort(
    (a, b) => a[1][a[1].length - 1] - b[1][b[1].length - 1]
  );
  const sobrantes = rateAttempts.size - RATE_MAX_CLAVES;
  for (const [clave] of porAntiguedad.slice(0, sobrantes)) {
    rateAttempts.delete(clave);
  }
}

function isRateLimited(key: string, max: number): boolean {
  const now = Date.now();

  // Barredo por intervalo, como el del middleware. Fuera de sus cinco minutos no
  // se recorre el mapa entero, porque recorrerlo en cada intento sería el precio
  // de cada intento. El tope, en cambio, se comprueba siempre: es una comparación
  // de tamaño, y es lo único que acota el pico.
  if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
    lastCleanup = now;
    limpiarRateAttempts(now);
  }
  expulsarSiHayDemasiadas();

  const attempts = (rateAttempts.get(key) || []).filter(
    (t) => now - t < RATE_WINDOW_MS
  );
  if (attempts.length >= max) return true;
  attempts.push(now);
  rateAttempts.set(key, attempts);
  return false;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const emailCrudo =
      typeof body?.email === "string" ? body.email.trim() : "";
    const website = typeof body?.website === "string" ? body.website : "";
    const startedAt = body?.startedAt;

    if (website.length > 0) {
      return NextResponse.json({
        ok: true,
        message: "Suscripción registrada",
      });
    }

    if (
      typeof startedAt !== "number" ||
      Date.now() - startedAt < MIN_FORM_TIME_MS
    ) {
      return NextResponse.json({
        ok: true,
        message: "Suscripción registrada",
      });
    }

    if (!emailCrudo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailCrudo)) {
      return NextResponse.json(
        { error: "Email inválido" },
        { status: 400 }
      );
    }

    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    if (isRateLimited(`ip:${clientIp}`, RATE_MAX_PER_IP)) {
      return NextResponse.json(
        { error: "Demasiados intentos. Inténtalo más tarde." },
        { status: 429 }
      );
    }

    // La clave del buzón va en minúsculas porque para el limiter el buzón es su
    // identidad: `Gasteiz.Click@…` y `gasteiz.click@…` tienen que contar como la
    // misma persona. El límite que acota el abuso real es el de IP, de arriba.
    if (isRateLimited(`${clientIp}|${emailCrudo.toLowerCase()}`, RATE_MAX_PER_EMAIL)) {
      return NextResponse.json(
        { error: "Demasiados intentos. Inténtalo más tarde." },
        { status: 429 }
      );
    }

    // A partir de aquí el correo ya no es el que escribió la persona: es la
    // cadena con la que la fila existe de verdad. Ver `correoParaGuardar`.
    const email = correoParaGuardar(emailCrudo);

    const { token, exists, active } = addSubscriber(email);

    const envio = await sendConfirmationEmail(email, token);

    /*
     * El resultado del envío decide la respuesta, y antes no decidía nada.
     *
     * `addSubscriber` ya ha escrito la fila, así que a este punto el alta está
     * registrada: el suscriptor existe y está en `active: false`, pendiente de
     * confirmar, y lo único que lo activa es abrir este correo. Si SMTP falla y
     * la ruta responde `200 {ok:true}` con «revisa tu correo», la persona se
     * queda esperando un correo que no existe, no hay ninguna señal de que
     * aquello fallara y la fila pendiente no vuelve a mirar nadie: en los logs
     * esto es un alta correcta. Es el mismo fallo silencioso que `lib/mail.ts` ya no
     * tiene en producción, y el sitio donde se nota es peor —no llega a mil
     * personas, llega a una y no llega.
     *
     * Error y no un `200` con otro mensaje: reintentar sí recupera, porque la fila
     * ya existe y el siguiente intento reenvía el enlace en vez de crear otra
     * fila, y el cliente (`lib/useNewsletterSubscribe.ts`) ya pinta `data.error`
     * cuando la respuesta no es 2xx. Un `200` dejaría el fallo invisible al
     * cliente y a cualquier monitor que mire los códigos de estado.
     *
     * 502 y no 500 porque la ruta no está rota: lo que se cayó es el SMTP que
     * tiene delante. La fila se queda como está a propósito —registra el interés
     * y es lo que hace que el reintento reenvíe el enlace en vez de duplicar—.
     */
    if (!envio.ok) {
      console.error(
        `No se pudo enviar el correo de confirmación a ${email}: ${envio.error}`
      );
      return NextResponse.json(
        {
          error:
            "No hemos podido enviar el correo de confirmación. Tu dirección está guardada: vuelve a intentarlo en unos minutos y te lo reenviamos.",
        },
        { status: 502 }
      );
    }

    // Tres casos y no dos. Con el alta directa, «ya estás suscrito» era cierto
    // siempre que el correo estaba en la lista; con la doble confirmación hay un
    // tercero —se dio de baja y vuelve a suscribirse— y ahí la frase sería
    // mentira: sigue en la lista, pero inactiva y esperando otro correo.
    return NextResponse.json({
      ok: true,
      message: !exists
        ? "Revisa tu correo para confirmar la suscripción."
        : active
          ? "Ya estás suscrito. Te hemos reenviado el email de confirmación."
          : "Te hemos reenviado el email de confirmación para volver a suscribirte.",
    });
  } catch (error) {
    console.error("Error subscribing:", error);
    return NextResponse.json(
      { error: "Error al procesar la suscripción" },
      { status: 500 }
    );
  }
}