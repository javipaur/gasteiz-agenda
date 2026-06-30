import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const SUBSCRIBERS_FILE = path.join(DATA_DIR, "subscribers.json");

type Subscriber = {
  email: string;
  subscribedAt: string;
  active: boolean;
  token: string;
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(SUBSCRIBERS_FILE)) {
    fs.writeFileSync(SUBSCRIBERS_FILE, "[]", "utf-8");
  }
}

function readSubscribers(): Subscriber[] {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(SUBSCRIBERS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeSubscribers(subscribers: Subscriber[]) {
  ensureDataDir();
  fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(subscribers, null, 2), "utf-8");
}

export function addSubscriber(email: string): { token: string; exists: boolean } {
  const subscribers = readSubscribers();
  const existing = subscribers.find((s) => s.email === email);

  if (existing) {
    if (!existing.active) {
      existing.active = true;
      writeSubscribers(subscribers);
    }
    return { token: existing.token, exists: true };
  }

  const token = crypto.randomUUID();
  subscribers.push({
    email,
    subscribedAt: new Date().toISOString(),
    active: true,
    token,
  });
  writeSubscribers(subscribers);
  return { token, exists: false };
}

export function removeSubscriber(token: string): boolean {
  const subscribers = readSubscribers();
  const index = subscribers.findIndex((s) => s.token === token);
  if (index === -1) return false;
  subscribers[index].active = false;
  writeSubscribers(subscribers);
  return true;
}

export function getActiveSubscribers(): Subscriber[] {
  return readSubscribers().filter((s) => s.active);
}

export function getAllSubscribers(): Subscriber[] {
  return readSubscribers();
}
