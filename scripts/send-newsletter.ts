/**
 * Script para enviar la newsletter semanal.
 * Uso: npx tsx scripts/send-newsletter.ts
 *
 * También se puede ejecutar como cron (Dokploy, GitHub Actions, etc.).
 *
 * Los eventos salen del agregador, no de un `fetch` a `/api/*`. Antes pedía
 * `/api/actividades/eventos/proximos` por HTTP sin `x-api-key`, lo que solo
 * funcionaba porque esa ruta estaba abierta por el `startsWith` de
 * `PUBLIC_API_ROUTES`. Un script del repo no debería depender de que su propio
 * despliegue le deje pasar: si corre en la misma máquina que sirve la web, ya
 * tiene `getProximosEventos` a mano, que es lo que hacen `app/api/*`,
 * `lib/turismo.ts` y `lib/gastronomia.ts`. Lo raro era el script.
 *
 * Lo que sí queda atado a la red es el SMTP, y por eso `lib/mail.ts` falla de
 * forma explícita en producción si faltan `EMAIL_USER`/`EMAIL_PASS`: es
 * preferible un código de salida 1 a una newsletter que no llega a nadie y un
 * cron que la da por enviada.
 */

export async function main() {
  console.log("[newsletter] Obteniendo eventos...");

  /**
   * `AsyncLocalStorage` no es global en Node 24 (`node:async_hooks` sí lo
   * exporta, pero hace falta importarlo), y `lib/agenda.ts` →
   * `lib/axiom/server.ts` → `@axiomhq/nextjs` lo lee de `globalThis` en el
   * momento de importarse. Dentro de Next eso ya está resuelto; en un script
   * suelto con `tsx` no, y el fallo es un `TypeError` en la línea 5 de
   * `storage.ts` del paquete, que no dice nada de qué lo ha provocado.
   *
   * Es el mismo apaño que hace `jest.setup.ts`, y por el mismo motivo. Va aquí
   * y no en un sitio global porque la única otra razón para necesitarlo es este
   * fichero: mientras el script no tocara el agregador —que es lo que pasaba
   * cuando pedía los eventos por HTTP— no hacía falta.
   */  if (typeof (globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage === "undefined") {
    const { AsyncLocalStorage } = await import("node:async_hooks");
    (globalThis as { AsyncLocalStorage: typeof AsyncLocalStorage }).AsyncLocalStorage =
      AsyncLocalStorage;
  }

  // Import dinámico a propósito: `lib/db` y `lib/email` arrastran `fs`,
  // `path` y `nodemailer`, y no tiene sentido cargarlos si el script va a
  // salir antes por no tener eventos.
  const { getProximosEventos } = await import("../lib/eventos");
  const eventos = await getProximosEventos();

  if (eventos.length === 0) {
    console.log("[newsletter] No hay eventos próximos.");
    return;
  }

  console.log(`[newsletter] ${eventos.length} eventos obtenidos.`);

  const { getActiveSubscribers } = await import("../lib/db");
  const subscribers = getActiveSubscribers();

  if (subscribers.length === 0) {
    console.log("[newsletter] No hay suscriptores activos.");
    return;
  }

  console.log(`[newsletter] Enviando a ${subscribers.length} suscriptores...`);

  const { sendWeeklyNewsletter } = await import("../lib/email");

  let sent = 0;
  let failed = 0;

  for (const sub of subscribers) {
    try {
      const result = await sendWeeklyNewsletter(eventos, sub.email, sub.token);
      if (result.ok) {
        sent++;
      } else {
        failed++;
        console.error(`[newsletter] Error enviando a ${sub.email}:`, result.error);
      }
    } catch (err) {
      failed++;
      console.error(`[newsletter] Error enviando a ${sub.email}:`, err);
    }
  }

  console.log(`[newsletter] ${sent} enviados, ${failed} fallos`);

  // Salida distinta de cero para que un cron o Dokploy no lo tome por bueno.
  if (failed > 0) {
    process.exitCode = 1;
  }
}

// Solo cuando el fichero es el programa que se ejecuta. Importado desde un
// test —o desde otro script— `main` se puede llamar sin que arranque nada solo.
if (require.main === module) {
  main().catch((error) => {
    console.error("[newsletter] Fallo grave:", error);
    process.exitCode = 1;
  });
}
