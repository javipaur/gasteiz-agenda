import { loadFixture } from "../helpers";
import { scrapeMiniature } from "@/lib/sources/miniature";

describe("scrapeMiniature", () => {
  function mockApi() {
    const fixture = loadFixture("miniature-response.json");
    jest
      .spyOn(global, "fetch")
      .mockImplementation(async (input: Parameters<typeof fetch>[0]) => {
        const url =
          typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
        if (!/miniature\.pintxos\.eus\/wp-json\/wp\/v2\/etn\?/.test(url)) {
          return new Response("", { status: 404 });
        }
        const page = Number(new URL(url).searchParams.get("page") || "1");
        if (page > 1) return new Response("[]", { status: 200 });
        return new Response(fixture, { status: 200 });
      });
  }

  it("parses future events with date, time, location and image", async () => {
    mockApi();

    const events = await scrapeMiniature();

    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);

    for (const e of events) {
      expect(e.title.length).toBeGreaterThan(0);
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.time).toMatch(/^\d{2}:\d{2}$/);
      expect(e.location.length).toBeGreaterThan(0);
      expect(e.link).toContain("miniature.pintxos.eus");
      expect(e.category).toBe("Gastronomía");
      expect(e.image).toMatch(/^https?:\/\//);
    }
  });

  it("keeps only events dated today or later", async () => {
    mockApi();

    const events = await scrapeMiniature();
    const today = new Date().toISOString().slice(0, 10);

    for (const e of events) {
      expect(e.date >= today).toBe(true);
    }
  });

  it("returns an empty array when the API fails", async () => {
    jest
      .spyOn(global, "fetch")
      .mockImplementation(async () => new Response("", { status: 500 }));

    const events = await scrapeMiniature();
    expect(events).toEqual([]);
  });
});