import { test, expect } from "@playwright/test";

const API_KEY = process.env.API_KEY;

test.describe("Public API", () => {
  test.beforeEach(() => {
    test.skip(!API_KEY, "API_KEY no está definido en .env");
  });

  const headers: Record<string, string> = API_KEY ? { "x-api-key": API_KEY } : {};

  test("GET /api/v1/events returns valid paginated data", async ({ request }) => {
    const res = await request.get("/api/v1/events", { headers, timeout: 60_000 });
    expect(res.status()).toBe(200);

    const body = await res.json();

    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta).toBeDefined();
    expect(typeof body.meta.total).toBe("number");

    for (const evento of body.data) {
      expect(typeof evento.title).toBe("string");
      expect(evento.title.length).toBeGreaterThan(0);
      expect(typeof evento.date).toBe("string");
      expect(typeof evento.link).toBe("string");
    }
  });

  test("supports limit and offset pagination", async ({ request }) => {
    const res = await request.get("/api/v1/events?limit=5&offset=0", {
      headers,
      timeout: 60_000,
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.data.length).toBeLessThanOrEqual(5);
    expect(body.meta.limit).toBe(5);
    expect(body.meta.hasMore).toBeDefined();
  });

  test("filters events by category", async ({ request }) => {
    const res = await request.get("/api/v1/events?category=conciertos", {
      headers,
      timeout: 60_000,
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    for (const evento of body.data) {
      await expect(evento.category.toLowerCase()).toMatch(/conciert|musica/);
    }
  });

  test("returns 200 for an RSS-adjacent public route", async ({ request }) => {
    const res = await request.get("/feed.xml", { timeout: 60_000 });
    expect(res.status()).toBe(200);
  });
});