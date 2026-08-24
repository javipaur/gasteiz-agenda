import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "fs";
import path from "path";
import webpush from "web-push";

export type StoredSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  addedAt: number;
};

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

const DB_DIR = process.env.PUSH_DB_DIR || path.join(process.cwd(), ".data");
const DB_PATH = path.join(DB_DIR, "push.db");

let db: DatabaseSync | null = null;

function getDb(): DatabaseSync {
  if (!db) {
    mkdirSync(DB_DIR, { recursive: true });
    db = new DatabaseSync(DB_PATH);
    db.exec(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        endpoint TEXT PRIMARY KEY,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        added_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }
  return db;
}

function getWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new Error("Faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY");
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://gasteizclick.javierpalacio.es";
  webpush.setVapidDetails(`mailto:admin@${new URL(siteUrl).hostname}`, publicKey, privateKey);
  return webpush;
}

export function addSubscription(sub: StoredSubscription): void {
  getDb()
    .prepare(
      `INSERT INTO subscriptions (endpoint, p256dh, auth, added_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth`
    )
    .run(sub.endpoint, sub.keys.p256dh, sub.keys.auth, sub.addedAt);
}

export function removeSubscription(endpoint: string): void {
  getDb().prepare("DELETE FROM subscriptions WHERE endpoint = ?").run(endpoint);
}

export function listSubscriptions(): StoredSubscription[] {
  return getDb()
    .prepare("SELECT endpoint, p256dh, auth, added_at FROM subscriptions")
    .all()
    .map((row) => ({
      endpoint: row.endpoint as string,
      keys: { p256dh: row.p256dh as string, auth: row.auth as string },
      addedAt: row.added_at as number,
    }));
}

function getMeta(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM meta WHERE key = ?").get(key);
  return row ? (row.value as string) : null;
}

function setMeta(key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run(key, value);
}

export type SendResult = {
  sent: number;
  failed: number;
  pruned: number;
  total: number;
};

export async function sendToAll(payload: PushPayload): Promise<SendResult> {
  const push = getWebPush();
  const subs = listSubscriptions();
  let sent = 0;
  let failed = 0;
  let pruned = 0;

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await push.sendNotification(sub, JSON.stringify(payload));
        sent++;
      } catch (err) {
        failed++;
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          removeSubscription(sub.endpoint);
          pruned++;
        }
      }
    })
  );

  return { sent, failed, pruned, total: subs.length };
}

export function localDateStr(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function shouldSendDailyDigest(): boolean {
  return getMeta("digest_sent_on") !== localDateStr();
}

export function markDigestSent(): void {
  setMeta("digest_sent_on", localDateStr());
}
