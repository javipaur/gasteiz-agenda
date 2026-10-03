#!/usr/bin/env node
import { readFileSync } from "fs";
import path from "path";
import process from "process";
import { DatabaseSync } from "node:sqlite";
import webpush from "web-push";

function parseArgs() {
  const args = { title: "", body: "", url: "/", digest: false };
  process.argv.slice(2).forEach((arg, i, arr) => {
    if (arg === "--title") args.title = arr[i + 1];
    if (arg === "--body") args.body = arr[i + 1];
    if (arg === "--url") args.url = arr[i + 1];
    if (arg === "--digest") args.digest = true;
  });
  return args;
}

function loadEnv() {
  try {
    const raw = readFileSync(path.resolve(".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {}
}

const DB_PATH = path.join(
  process.env.PUSH_DB_DIR || path.join(process.cwd(), ".data"),
  "push.db"
);

/**
 * Cuánto espera esta conexión a que otra suelte el lock.
 *
 * Mismo número que `lib/push.ts` y por el mismo motivo: `busy_timeout` es una cosa
 * **por conexión**, así que ponerlo solo en el proceso de Next no protege a este.
 * Sin él, cualquier solape con el digest es un `SQLITE_BUSY` instantáneo —medido:
 * 0 ms— en vez de una espera.
 */
const BUSY_TIMEOUT_MS = 5000;

/**
 * Los códigos con los que SQLite dice «hay otro proceso aquí», y no «no hay base».
 *
 * `SQLITE_BUSY` (5) es el writer esperando a otro writer, y `SQLITE_LOCKED` (6) el
 * conflicto dentro de la propia conexión. Los dos son reintentos; el resto —un 14
 * `SQLITE_CANTOPEN` porque no existe el fichero, un 26 `SQLITE_NOTADB` porque lo que
 * hay no es una base— son de otra categoría y no tienen nada que ver.
 */
const ES_BLOQUEO = new Set([5, 6]);

function esBloqueo(err) {
  return ES_BLOQUEO.has(err?.errcode) || /locked|busy/i.test(err?.message ?? "");
}

async function main() {
  loadEnv();

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    console.error("Faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY en .env");
    process.exit(1);
  }

  let payload;
  const args = parseArgs();

  if (args.digest) {
    // El digest lo construye el servidor: llama al endpoint interno.
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const res = await fetch(`${siteUrl}/api/push/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.API_KEY || "",
      },
      body: JSON.stringify({}),
    });

    const texto = await res.text();

    /*
     * Mirar `res.ok` antes de mirar el cuerpo, y es lo que faltaba.
     *
     * Sin esto, con `API_KEY` ausente o equivocada la respuesta del middleware es
     * `{"error":"Unauthorized…"}`, se imprimía con el prefijo `digest:` y `main()`
     * resolvía con éxito. El cron se lo creía: una noche de digest que no había
     * salido, dada por hecha, y sin reintento porque ya había pasado la hora.
     *
     * `scripts/send-newsletter.ts:88-90` ya lo hacía bien —código de salida
     * distinto de cero si algo falla— y es el modelo a seguir: es lo mismo que un
     * cron necesite para no darse por notificado.
     */
    if (!res.ok) {
      console.error(
        `digest: el servidor respondió ${res.status} y no se ha enviado nada.`,
        texto
      );
      process.exitCode = 1;
      return;
    }

    console.log("digest:", texto);
    return;
  }

  if (!args.title || !args.body) {
    console.error(
      "Uso: npm run push -- --title \"...\" --body \"...\" [--url /evento/...]\n" +
        "   o: npm run push -- --digest  (resumen del día vía API)"
    );
    process.exit(1);
  }

  let subs = [];
  try {
    const db = new DatabaseSync(DB_PATH, { readOnly: true });
    // También aquí: en `readOnly` no se puede cambiar `journal_mode`, pero el
    // `busy_timeout` sí, y es el que evita que un `SELECT` se caiga por un
    // `SQLITE_BUSY` mientras el digest escribe.
    db.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
    subs = db
      .prepare("SELECT endpoint, p256dh, auth FROM subscriptions")
      .all();
    db.close();
  } catch (err) {
    /*
     * Un `catch` vacío que dice siempre «no hay base» miente en cuanto hay dos
     * procesos, que es lo que pasa: el scheduler de Next y este cron sobre el mismo
     * fichero. Lo que hay que distinguir es si **no existe** o si está **ocupada**.
     */
    if (esBloqueo(err)) {
      console.error(
        `La base de suscripciones está bloqueada por otro proceso (${DB_PATH}).` +
          " Vuelve a intentarlo en unos segundos."
      );
      // Código 1 y no 0: un bloqueo es un fallo transitorio del que hay que
      // reintentar, y un cron con 0 no lo va a reintentar.
      process.exitCode = 1;
      return;
    }
    console.log("No hay base de datos de suscripciones todavía:", DB_PATH);
    return;
  }

  if (subs.length === 0) {
    console.log("No hay suscripciones registradas.");
    return;
  }

  console.log(`Enviando a ${subs.length} suscripción(es)…`);

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://gasteizclick.javierpalacio.es";
  webpush.setVapidDetails(
    `mailto:admin@${new URL(siteUrl).hostname}`,
    publicKey,
    privateKey
  );

  payload = JSON.stringify({
    title: args.title.slice(0, 120),
    body: args.body.slice(0, 300),
    url: args.url,
  });

  let sent = 0;
  const dead = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, payload);
        sent++;
        console.log("✓", sub.endpoint.slice(0, 60));
      } catch (err) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          dead.push(sub.endpoint);
          console.log("✗ caducada", sub.endpoint.slice(0, 60));
        } else {
          console.error("✗", err?.message || err);
        }
      }
    })
  );

  if (dead.length) {
    const db = new DatabaseSync(DB_PATH);
    // El mismo `busy_timeout` en la escritura: la poda coge el lock de escritura,
    // que es justo el que choca con el digest si el cron y el scheduler se cruzan.
    db.exec(`PRAGMA busy_timeout = ${BUSY_TIMEOUT_MS}`);
    const del = db.prepare("DELETE FROM subscriptions WHERE endpoint = ?");
    for (const endpoint of dead) del.run(endpoint);
    db.close();
    console.log(`Limpiadas ${dead.length} suscripción(es) caducadas`);
  }

  console.log(`Listo: ${sent}/${subs.length} entregadas.`);
}

main().catch((err) => {
  console.error("send-push: fallo grave:", err);
  process.exitCode = 1;
});
