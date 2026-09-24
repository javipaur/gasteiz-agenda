import { loadFixture, mockFetchWith, EMPTY_HTML } from "../helpers";
import { scrapeVamEvents, scrapeVamConciertos } from "@/lib/sources/vam";

describe("scrapeVamEvents", () => {
  it("parses VAM API JSON and filters Vitoria-Gasteiz events", async () => {
    const json = loadFixture("vam-response.json");

    const fetchMock = mockFetchWith([
      { match: /app\.vamcultura\.es/, content: json },
      { match: /.*/, content: EMPTY_HTML },
    ]);

    const events = await scrapeVamEvents();

    expect(fetchMock).toHaveBeenCalled();
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);

    for (const e of events) {
      expect(typeof e.title).toBe("string");
      expect(e.title.length).toBeGreaterThan(0);
      expect(typeof e.date).toBe("string");
      expect(typeof e.link).toBe("string");
      expect(e.source).toBe("vam");
      expect(typeof e.category).toBe("string");
    }
  });

  it("assigns DEFAULT_EVENT_IMAGE to events with no image", async () => {
    const json = loadFixture("vam-response.json");

    mockFetchWith([
      { match: /app\.vamcultura\.es/, content: json },
      { match: /.*/, content: EMPTY_HTML },
    ]);

    const events = await scrapeVamEvents();
    for (const e of events) {
      expect(typeof e.image).toBe("string");
      expect(e.image!.length).toBeGreaterThan(0);
    }
  });

  it("returns an empty array when the API returns an error", async () => {
    mockFetchWith([
      { match: /app\.vamcultura\.es/, content: "", status: 500 },
    ]);

    const events = await scrapeVamEvents();
    expect(events).toEqual([]);
  });

  it("includes events whose city is spelled 'Vitoria'", async () => {
    const json = JSON.stringify({
      events: [
        {
          id: "1",
          title: "Magufada",
          city: "Vitoria",
          category: "Concierto / Música",
          date_start: "2026-09-25T21:00:00+02:00",
          image_url: "",
          source_url: "#",
        },
        {
          id: "2",
          title: "No vitoriano",
          city: "Bilbao",
          category: "Concierto / Música",
          date_start: "2026-09-25T21:00:00+02:00",
          image_url: "",
          source_url: "#",
        },
      ],
    });

    mockFetchWith([
      { match: /app\.vamcultura\.es/, content: json },
    ]);

    const events = await scrapeVamEvents();
    expect(events.map((e) => e.title)).toEqual(["Magufada"]);
  });

  describe("scrapeVamConciertos", () => {
    it("finds Vitoria concerts and ignores other cities/categories", async () => {
      const json = JSON.stringify({
        events: [
          {
            id: "1",
            title: "Magufada",
            city: "Vitoria",
            category: "Concierto / Música",
            date_start: "2026-09-25T21:00:00+02:00",
            image_url: "",
            source_url: "#",
          },
          {
            id: "2",
            title: "Charla vitoriana",
            city: "Vitoria-Gasteiz",
            category: "Conferencia",
            date_start: "2026-09-25T19:00:00+02:00",
            image_url: "",
            source_url: "#",
          },
          {
            id: "3",
            title: "Concierto bilbaíno",
            city: "Bilbao",
            category: "Concierto / Música",
            date_start: "2026-09-25T21:00:00+02:00",
            image_url: "",
            source_url: "#",
          },
        ],
      });

      mockFetchWith([
        { match: /app\.vamcultura\.es/, content: json },
      ]);

      const events = await scrapeVamConciertos();
      expect(events.map((e) => e.title)).toEqual(["Magufada"]);
    });
  });
});