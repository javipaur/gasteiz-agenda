import {
  fetchOgImage,
  formatDate,
  formatSpanishDate,
  localDateStr,
  sourceLabel,
  dayBadgeLabel,
  shortTime,
} from "@/lib/utils";
import { SOURCE_LABELS } from "@/lib/source-registry";
import { mockFetchWith, EMPTY_HTML } from "./helpers";

describe("fetchOgImage", () => {
  it("extracts og:image from HTML", async () => {
    mockFetchWith([
      {
        match: /example\.com/,
        content: `<html><head><meta property="og:image" content="https://example.com/og.jpg"></head></html>`,
      },
    ]);

    const image = await fetchOgImage("https://example.com/posts/1");
    expect(image).toBe("https://example.com/og.jpg");
  });

  it("falls back to twitter:image", async () => {
    mockFetchWith([
      {
        match: /example\.com/,
        content: `<html><head><meta name="twitter:image" content="https://example.com/tw.jpg"></head></html>`,
      },
    ]);

    const image = await fetchOgImage("https://example.com/posts/2");
    expect(image).toBe("https://example.com/tw.jpg");
  });

  it("resolves relative og:image to absolute URLs", async () => {
    mockFetchWith([
      {
        match: /example\.com/,
        content: `<html><head><meta property="og:image" content="/img/rel.jpg"></head></html>`,
      },
    ]);

    const image = await fetchOgImage("https://example.com/posts/3");
    expect(image).toBe("https://example.com/img/rel.jpg");
  });

  it("returns undefined when no meta image found", async () => {
    mockFetchWith([
      { match: /.*/, content: EMPTY_HTML },
    ]);

    const image = await fetchOgImage("https://empty.example.com/x");
    expect(image).toBeUndefined();
  });
});

describe("formatDate", () => {
  it("formats a date into day and month", () => {
    const { day, month } = formatDate("2026-09-16T10:00:00Z");
    expect(day).toBe("16");
    expect(month).toBe("SEP");
  });

  it("returns placeholder for invalid dates", () => {
    const { day, month } = formatDate("not-a-date");
    expect(day).toBe("??");
    expect(month).toBe("???");
  });
});

describe("formatSpanishDate", () => {
  it("returns day, month and year", () => {
    const { day, month, year } = formatSpanishDate("2026-09-16T10:00:00Z");
    expect(day).toBe("16");
    expect(month).toBe("SEP");
    expect(year).toBe("2026");
  });
});

describe("localDateStr", () => {
  it("returns YYYY-MM-DD", () => {
    expect(localDateStr(new Date("2026-09-16T10:00:00Z"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("sourceLabel", () => {
  it("etiqueta todas las fuentes del registro", () => {
    for (const [id, label] of Object.entries(SOURCE_LABELS)) {
      expect(sourceLabel(id)).toBe(label);
    }
  });

  it("devuelve el slug crudo si la fuente no existe", () => {
    expect(sourceLabel("fuente-inventada")).toBe("fuente-inventada");
    expect(sourceLabel(undefined)).toBe("");
  });

  it("traduce los ids que solo emite la agregación antigua", () => {
    // Mientras `lib/eventos.ts`, `lib/deporte.ts` y `lib/kids.ts` sigan vivos, la
    // home los pinta con estos ids en vez de con los del registro. Sin traducción,
    // cada tarjeta del Ayuntamiento enseñaría "vitoria-gasteiz" en crudo.
    expect(sourceLabel("vitoria-gasteiz")).toBe(SOURCE_LABELS["municipal-agenda"]);
    expect(sourceLabel("vitoria-gasteiz-rss")).toBe(SOURCE_LABELS["municipal-rss"]);
  });

  it("no revive jimmy-jazz-gasteiz", () => {
    // Nadie lo emite ya. Si `sourceLabel` volviera a traducirlo, el bug de
    // etiquetas reaparecería con él en el momento en que alguien reusara el
    // nombre viejo.
    expect(SOURCE_LABELS["jimmy-jazz-gasteiz"]).toBeUndefined();
    expect(sourceLabel("jimmy-jazz-gasteiz")).toBe("jimmy-jazz-gasteiz");
  });
});

describe("dayBadgeLabel", () => {
  it("returns null for non-today dates", () => {
    const future = new Date();
    future.setDate(future.getDate() + 5);
    expect(dayBadgeLabel(future.toISOString())).toBeNull();
  });
});

describe("shortTime", () => {
  it("parses H:mm formats", () => {
    expect(shortTime("20:30")).toBe("20:30");
    expect(shortTime("8:15 h")).toBe("8:15");
  });

  it("returns null for unparseable times", () => {
    expect(shortTime("")).toBeNull();
    expect(shortTime("mañana")).toBeNull();
  });
});