import { shouldSendDailyDigest, markDigestSent, sendToAll } from "./push";
import { buildDailyDigest } from "./digest";

const CHECK_INTERVAL = 10 * 60 * 1000;

async function tick() {
  try {
    const now = new Date();
    const hour = Number(process.env.PUSH_DIGEST_HOUR || "9");
    if (now.getHours() < hour) return;
    if (!shouldSendDailyDigest()) return;

    const payload = await buildDailyDigest();
    const result = await sendToAll(payload);
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
    `[push] scheduler activo · digest a las ${process.env.PUSH_DIGEST_HOUR || "9"}:00 (Europe/Madrid del servidor)`
  );
  setTimeout(tick, 30_000);
  setInterval(tick, CHECK_INTERVAL);
}
