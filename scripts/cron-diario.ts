// El contenedor del cron: ejecuta `npm run promo:send` una vez al día y se apaga.
//
// Uso: npx tsx scripts/cron-diario.ts
//
// **Por qué un contenedor aparte y no un `setInterval` dentro de la web.** El scheduler que
// ya hay (`instrumentation.ts`, para el push) vive en el proceso de Next, así que si el
// contenedor de la web se reinicia —y se reinicia en cada despliegue— el paquete de ese
// día no se manda y no hay forma de recuperarlo. Para el push da igual: se pierde una
// notificación. Para el correo del fin de semana no: se pierde un día entero de planes, y
// quien publica abre el buzón y no encuentra nada.
//
// Con un contenedor aparte, un reinicio de la web **no toca el cron**. Y si el cron falla,
// el log lo dice y la web sigue sirviendo.
//
// **Sale con 0 aunque el script falle, y eso parece un error y no lo es.** Este contenedor
// no debe reiniciarse ni parar por un fallo del correo: si saliera con 1, el orquestador
// lo reiniciaría en bucle y la única forma de recuperar el día sería reiniciar a mano. El
// fallo que importa —el agregado degradado— ya sale con 1 **desde el script**, y con eso
// basta: se registra y se sigue.
//
// **Duerme hasta las nueve y ejecuta una vez.** Un bucle de un minuto parece más
// robusto, pero reintenta 1.440 veces al día un trabajo que solo tiene sentido por la
// mañana, y una avería se convierte en 1.440 líneas iguales en el log.

const HORA = Number(process.env.CROM_PROMO_HORA ?? "09");
const MINUTO = Number(process.env.CROM_PROMO_MINUTO ?? "0");

/**
 * Las nueve del reloj del contenedor, y no las del UTC.
 *
 * **`TZ=Europe/Madrid` en la imagen es lo que lo hace posible.** Sin él, un contenedor Node
 * corre en UTC y a las nueve de Madrid el cron dispararía a las once en verano y a las
 * diez en invierno —el mismo error que ya tenía `PUSH_DIGEST_HOUR` y que está escrito en
 * `lib/scheduler.ts`. La zona la pone la imagen y el código no la vuelve a decidir.
 *
 * Se calcula el hueco **hasta las nueve de mañana, no un intervalo de 24 horas**: un
 * intervalo desde el arranque se va desplazando cada día y acabaría disparando a las
 * cuatro de la tarde. La distancia se recalcula en cada vuelta, así que el desfase nunca
 * se acumula.
 */
function msHastaLasNueve(): number {
  const ahora = new Date();
  const objetivo = new Date(ahora);
  objetivo.setHours(HORA, MINUTO, 0, 0);

  // Si las nueve ya pasaron hoy, mañana. `setHours` deja el día igual si la hora ya fue,
  // así que el `if` es el que salta al día siguiente.
  if (objetivo.getTime() <= ahora.getTime()) {
    objetivo.setDate(objetivo.getDate() + 1);
  }
  return objetivo.getTime() - ahora.getTime();
}

function esperarHastaLasNueve(): Promise<void> {
  const ms = msHastaLasNueve();
  const cuando = new Date(Date.now() + ms);
  console.log(
    `[cron] Duermo ${Math.round(ms / 60000)} min · dispararé a las ` +
      `${cuando.toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}`
  );

  return new Promise((resolve) => {
    // **El temporizador más largo de Node son ~24,8 días**, y `setTimeout` con más de eso
    // dispara de inmediato. A las nueve del día siguiente son 24 horas, así que se
    // descarta que reviente, pero el margen se recorta un minuto para no estar justo.
    const seguro = Math.min(ms, 24 * 60 * 60 * 1000 - 60_000);
    setTimeout(resolve, seguro);
  });
}

async function correr(): Promise<void> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");

  console.log(`[cron] Lanzando promo:send a las ${new Date().toLocaleTimeString("es-ES")}`);

  try {
    // **Un buffer grande** porque el script escribe en el log lo que ve de 28 fuentes, y el
    // límite por defecto de `execFile` revienta antes de devolver nada. Con `Promise.allSettled`
    // en `lib/agenda.ts` el log puede llevar varias líneas por fuente.
    const r = await promisify(execFile)(
      "npx",
      ["tsx", "scripts/enviar-promo.ts"],
      { maxBuffer: 16 * 1024 * 1024, timeout: 10 * 60 * 1000, env: process.env } as never
    );
    console.log("[cron] promo:send terminó correctamente");
    console.log(r.stdout?.toString().trimEnd() ?? "");
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string; code?: unknown };

    // **Se registra y se sale con 0.** El código de salida del script ya va en su log, y lo
    // que este contenedor añade es la fecha y la razón por la que se paró. El orquestador no
    // debe enterarse: si saliera distinto de cero, lo reiniciaría en bucle.
    console.error("[cron] promo:send NO terminó bien");
    console.error(err.stdout?.toString().trimEnd() ?? "");
    console.error(err.stderr?.toString().trimEnd() ?? err.message ?? "");
  }
}

async function main(): Promise<void> {
  // El `.env` antes de nada, aunque en el contenedor las variables vienen del entorno. El
  // script también lo carga —`prepararEntornoScript`— y aquí se hace lo mismo para que un
  // `docker run` a pelo, sin variables, diga qué falta en vez de fallar a medias.
  const { prepararEntornoScript } = await import("./entorno");
  await prepararEntornoScript();

  console.log(
    `[cron] Zona ${process.env.TZ ?? "sin TZ"} · dispara a las ` +
      `${String(HORA).padStart(2, "0")}:${String(MINUTO).padStart(2, "0")}`
  );

  for (;;) {
    await esperarHastaLasNueve();
    await correr();
  }
}

void main().catch((error) => {
  console.error("[cron] Fallo grave:", error);
  // Sale con 1 aquí sí, porque es un fallo del propio contenedor y no del envío: si no
  // arrancara, un reinicio es lo único que puede arreglarlo.
  process.exitCode = 1;
});