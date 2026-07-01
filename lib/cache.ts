import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';

const CACHE_DIR = path.join(tmpdir(), 'gasteiz-cache');

function sanitizeKey(key: string): string {
  return Buffer.from(key).toString('base64url').slice(0, 120);
}

export async function getCachedOrFetch<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const filePath = path.join(CACHE_DIR, `${sanitizeKey(key)}.json`);

  try {
    const stat = await fs.stat(filePath);
    const age = Date.now() - stat.mtimeMs;
    if (age < ttlMs) {
      const raw = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch {}

  const data = await fetcher();

  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 0), 'utf-8');
  } catch {}

  return data;
}
