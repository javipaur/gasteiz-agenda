import puppeteer, { Page } from 'puppeteer';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export async function withPuppeteerCache<T>(
  cache: { entry: CacheEntry<T> | null },
  ttl: number,
  fn: (page: Page) => Promise<T>
): Promise<{ cached: boolean; data: T; warning?: string }> {
  const now = Date.now();

  if (cache.entry && (now - cache.entry.timestamp) < ttl) {
    return { cached: true, data: cache.entry.data };
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    const data = await fn(page);
    cache.entry = { data, timestamp: now };
    return { cached: false, data };
  } finally {
    await browser.close();
  }
}