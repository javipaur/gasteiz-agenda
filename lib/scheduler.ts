import { shouldSendDailyDigest, markDigestSent, sendToAll } from "./push";
import { buildDailyDigest } from "./digest";
import { podarSiToca } from "./metricas-store";

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
 * Cuánto se guarda el contador de visitas, en días.
 *
 * El mismo presupuesto que el resto de las cosas que se guardan, y por el mismo
 * motivo: lo que interesa es la tendencia reciente, y una fila por visita son
 * unos 40 bytes, así que un año son quince megabytes y dos años treinta. Un mes
 * da para comparar meses; un año da para comparar con el mismo mes del año pasado.
 *
 * De donde sale el 400 **no es de este repositorio**: es el horizonte que se mira
 * en el panel. Si algún día hace falta más historia, se sube aquí y en ningún otro
 * sitio.
 */
const DIAS_DE_METRICAS = 400;

/**
 * Un tick del digest. Exportado para poder probarlo sin arrancar el temporizador.
 *
 * `startScheduler` es lo que se llama en `instrumentation.ts`; esto es lo que hay
 * debajo, y lo que un test necesita para poder mirar una decisión sin esperar diez
 * minutos.
 */
/**
 * Qué partes del scheduler hay que arrancar.
 *
 * Cada una tiene su puerta en `instrumentation.ts` y su motivo escrito allí, y por
 * eso esto son dos banderas y no un interruptor: el digest se puede querer apagado
 * sin que la tabla de métricas deje de podarse, que era exactamente lo que pasaba
 * cuando compartían puerta.
 */
export type SchedulerOpciones = {
  /** Digest diario de push. */
  push: boolean;
  /** Poda diaria de `metricas.db`. */
  metricas: boolean;
};

/**
 * Lo que se arranca cuando nadie dice nada.
 *
 * El push es lo que estaba detrás de `ENABLE_PUSH_SCHEDULER`; las métricas son lo
 * nuevo, y por defecto sí, porque una tabla que crece sin poda solo molesta cuando
 * ya es un problema.
 */
const TODO_POR_DEFECTO: SchedulerOpciones = { push: true, metricas: true };

export async function tick(
  opciones: SchedulerOpciones = TODO_POR_DEFECTO
): Promise<void> {
  /*
   * La poda va **antes** del digest, en su propio `try`, y **protegida por su
   * propia puerta** en vez de depender de la del push.
   *
   * Antes estaba detrás de la del digest, así que apagar `ENABLE_PUSH_SCHEDULER`
   * apagaba también la poda: sin push no arrancaba este módulo, `podarSiToca()` no
   * se llamaba nunca y `metricas.db` crecía para siempre. No salía ningún error,
   * porque no fallaba nada: simplemente nadie pasaba por ahí. Es el modo de fallo
   * que este repo lleva corrigiendo desde el principio —el que no da error, da
   * silencio— y por eso el `if` va con su motivo y no como un detalle.
   *
   * El `try` aparte es por lo otro: si el digest lanza —que lanza, si un scraper
   * está caído— el `catch` de abajo se come el error, y la poda no llegaría a
   * ejecutarse en un día con la agenda rota, que es justo el día en que más falta
   * hace que la tabla no crezca.
   */
  if (opciones.metricas) {
    try {
      const podadas = podarSiToca(DIAS_DE_METRICAS);
      if (podadas !== null && podadas > 0) {
        console.log(
          `[metricas] poda: ${podadas} filas de más de ${DIAS_DE_METRICAS} días`
        );
      }
    } catch (err) {
      console.error("[metricas] error en la poda:", err);
    }
  }

  /* Sin push no hay digest, y esta función no hace nada más. */
  if (!opciones.push) return;

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

/**
 * Arranca el temporizador, y dice qué ha arrancado.
 *
 * El mensaje del arranque lleva las dos partes porque es el primer log que se lee
 * cuando algo no cuadra: sin él, un despliegue con el push apagado y las métricas
 * activas muestra una línea que habla solo del push, y parecería que no hay nada
 * corriendo cuando en realidad la poda sí está.
 */
export function startScheduler(opciones: SchedulerOpciones = TODO_POR_DEFECTO) {
  const partes = [
    opciones.push
      ? `digest a las ${horaDelDigest()}:00 (${zonaDelProceso()})`
      : "sin digest",
    opciones.metricas ? `poda de métricas cada día` : "sin poda",
  ];
  console.log(`[scheduler] activo — ${partes.join(", ")}`);
  setTimeout(() => tick(opciones), 30_000);
  setInterval(() => tick(opciones), CHECK_INTERVAL);
}