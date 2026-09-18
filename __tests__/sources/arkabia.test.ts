import { loadFixture, mockFetchWith, EMPTY_HTML } from "../helpers";
import { scrapeArkabia } from "@/lib/sources/arkabia";

describe("scrapeArkabia", () => {
  it("gets the nonce from the homepage and parses the AJAX events", async () => {
    const home = loadFixture("arkabia-home.html");
    const ajax = loadFixture("arkabia-ajax.json");

    const fetchMock = mockFetchWith([
      { match: /https:\/\/arkabia\.eus\/$/, content: home },
      { match: /admin-ajax\.php/, content: ajax },
      { match: /.*/, content: EMPTY_HTML },
    ]);

    const events = await scrapeArkabia();

    expect(fetchMock).toHaveBeenCalled();
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);

    for (const e of events) {
      expect(typeof e.title).toBe("string");
      expect(e.title.length).toBeGreaterThan(0);
      expect(typeof e.link).toBe("string");
      expect(typeof e.image).toBe("string");
      expect(Array.isArray(e.categoria)).toBe(true);
    }
  });

  it("parses category, fecha and precio from items", async () => {
    const home = loadFixture("arkabia-home.html");
    const ajax = loadFixture("arkabia-ajax.json");

    mockFetchWith([
      { match: /https:\/\/arkabia\.eus\/$/, content: home },
      { match: /admin-ajax\.php/, content: ajax },
      { match: /.*/, content: EMPTY_HTML },
    ]);

    const events = await scrapeArkabia();
    const first = events[0];

    expect(first.categoria.length).toBeGreaterThan(0);
    expect(first.fecha).toBeTruthy();
    expect(first.precio).toBeTruthy();
    expect(first.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns an empty array when the homepage fetch fails", async () => {
    mockFetchWith([
      { match: /arkabia\.eus/, content: "", status: 500 },
    ]);

    const events = await scrapeArkabia();
    expect(events).toEqual([]);
  });

  it("returns an empty array when the AJAX response fails", async () => {
    const home = loadFixture("arkabia-home.html");

    mockFetchWith([
      { match: /https:\/\/arkabia\.eus\/$/, content: home },
      { match: /admin-ajax\.php/, content: "{}", status: 500 },
      { match: /.*/, content: EMPTY_HTML },
    ]);

    const events = await scrapeArkabia();
    expect(events).toEqual([]);
  });
});