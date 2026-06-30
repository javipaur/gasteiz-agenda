/**
 * Script para enviar la newsletter semanal.
 * Uso: npx tsx scripts/send-newsletter.ts
 *
 * También se puede ejecutar como cron (Vercel Cron, GitHub Actions, etc.)
 *
 * Para producción con Vercel, mejor crear una API route:
 *   GET /api/cron/send-newsletter
 * y llamarla con Vercel Cron Jobs.
 */

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

async function main() {
  console.log("[newsletter] Obteniendo eventos...");

  const res = await fetch(`${BASE_URL}/api/actividades/eventos/proximos`, {
    next: { revalidate: 0 },
  });
  const data = await res.json();
  const eventos = data?.data || data?.eventos || (Array.isArray(data) ? data : []);

  if (eventos.length === 0) {
    console.log("[newsletter] No hay eventos próximos.");
    return;
  }

  console.log(`[newsletter] ${eventos.length} eventos obtenidos.`);

  // Get subscribers
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

  console.log(`[newsletter] ✅ ${sent} enviados, ❌ ${failed} fallos`);
}

main().catch(console.error);
