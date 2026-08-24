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
    console.log("digest:", await res.text());
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
    subs = db
      .prepare("SELECT endpoint, p256dh, auth FROM subscriptions")
      .all();
  } catch {
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
    const del = db.prepare("DELETE FROM subscriptions WHERE endpoint = ?");
    for (const endpoint of dead) del.run(endpoint);
    console.log(`Limpiadas ${dead.length} suscripción(es) caducadas`);
  }

  console.log(`Listo: ${sent}/${subs.length} entregadas.`);
}

main();
