import { shouldSendDailyDigest, markDigestSent, sendToAll } from "./push";
import { buildDailyDigest } from "./digest";

const CHECK_INTERVAL = 10 * 60 * 1000;

/**
 * La zona en la que "las nueve" son las nueve.
 *
 * Estaba implícita en `now.getHours()`, que es la hora local del proceso. En un
 * contenedor Node sin `TZ` eso es UTC, así que `PUSH_DIGEST_HOUR=9` disparaba a las
 * 11:00 en horario de verano y a las 10:00 en el de invierno. El log de arranque lo
 * decía —«Europe/Madrid del servidor»— y justo eso era lo que no estaba
 * garantizado: la zona la ponía la imagen, no el código.
 *
 * Se lee de `TZ` con este valor por defecto, y no al revés, porque hay dos verdades
 * y una sola es de este repositorio: la zona de un despliegue es una decisión de
 * quien despliega (`nixpacks.toml` la pone), y el valor por defecto es lo que hace
 * que funcione aquí sin configurar nada. Quien quiera otro público lo pone en `TZ`.
 */
const ZONA_POR_DEFECTO = "Europe/Madrid";

function zonaDelProceso(): string {
  const zona = process.env.TZ?.trim();
  if (!zona) return ZONA_POR_DEFECTO;

  /*
   * Una `TZ` mal escrita es un `RangeError` de `Intl`, y si eso se deja subir
   * llega al `catch` de `tick`: el digest no sale y cada diez minutos sale un
   * error que habla de `Intl` y no de `TZ`. Se comprueba aquí, una vez, para que
   * una errata caiga en el valor por defecto y se diga en el log de arranque, que
   * es donde se lee.
   *
   * Y por eso no hay ningún `getHours()` en este fichero: un `getHours()` es
   * «la zona del proceso», que es exactamente lo que hay que dejar de usar.
   */
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: zona });
    return zona;
  } catch {
    console.error(
      `[push] TZ="${zona}" no es una zona válida; se usa ${ZONA_POR_DEFECTO}`
    );
    return ZONA_POR_DEFECTO;
  }
}

/**
 * La hora que marca el reloj en la zona pedida.
 *
 * `Intl` y no un `getHours()`: es lo único que sabe qué hora es en *otro* huso sin
 * cambiar el del proceso. Va a número porque `hour` viene del entorno y
 * `Number("hola")` es `NaN`, y una comparación con `NaN` es siempre falsa, o sea
 * que una `PUSH_DIGEST_HOUR` mal escrita dejaría el digest sin salir nunca y sin
 * decir nada.
 */
function horaEn(d: Date, zona: string): number {
  const partes = new Intl.DateTimeFormat("en-GB", {
    timeZone: zona,
    hour: "numeric",
    hour12: false,
  }).formatToParts(d);
  return Number(partes.find((p) => p.type === "hour")?.value);
}

function horaDelDigest(): number {
  const hora = Number(process.env.PUSH_DIGEST_HOUR ?? "9");
  return Number.isFinite(hora) ? hora : 9;
}

/**
 * Un tick del digest. Exportado para poder probarlo sin arrancar el temporizador.
 *
 * `startScheduler` es lo que se llama en `instrumentation.ts`; esto es lo que hay
 * debajo, y lo que un test necesita para poder mirar una decisión sin esperar diez
 * minutos.
 */
export async function tick(): Promise<void> {
  try {
    const zona = zonaDelProceso();
    if (horaEn(new Date(), zona) < horaDelDigest()) return;
    if (!shouldSendDailyDigest()) return;

    const payload = await buildDailyDigest();
    const result = await sendToAll(payload);

    /*
     * Solo se marca si ha salido algo, y la razón es `sendToAll`.
     *
     * `sendToAll` usa `Promise.allSettled`, así que nunca propaga un fallo por
     * suscripción: cuenta y devuelve `{sent: 0, failed: N}`. Marcando siempre, una
     * caída de FCM de treinta segundos escribía `digest_sent_on` y ese día ya no se
     * reintentaba: nadie recibía el digest y el `catch` de más abajo no se.enteraba
     * de nada. Con filas basura metidas por `/api/push/subscribe` —que es pública—
     * lo mismo: `total` grande y nadie a quien le haya llegado.
     *
     * El caso de `total === 0` sí se marca, y a propósito: no es un fallo, es que no
     * hay a quién avisar. Reintentar cada diez minutos contra una lista vacía son
     * 144 digest builds al día, cada uno con su scrape de la agenda, y no puede
     * mejorar.
     */
    const nadieRecibio = result.sent === 0 && result.total > 0;
    if (nadieRecibio) {
      console.error(
        `[push] digest diario NO enviado: 0/${result.total} entregados, ${result.failed} fallos. Se reintentará en el siguiente tick`
      );
      return;
    }

    markDigestSent();
    console.log(
      `[push] digest diario: ${result.sent}/${result.total} entregados, ${result.pruned} suscripciones limpiadas`
    );
  } catch (err) {
    console.error("[push] error en el scheduler:", err);
  }
}

export function startScheduler() {
  console.log(
    `[push] scheduler activo · digest a las ${horaDelDigest()}:00 (${zonaDelProceso()})`
  );
  setTimeout(tick, 30_000);
  setInterval(tick, CHECK_INTERVAL);
}
