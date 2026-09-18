import crypto from "crypto";
import { getCachedOrFetch } from "@/lib/cache";

function uniqueKey(): string {
  return `test-${crypto.randomUUID()}`;
}

describe("getCachedOrFetch", () => {
  it("calls the fetcher on cache miss", async () => {
    const fetcher = jest.fn().mockResolvedValue({ items: [1, 2, 3] });

    const result = await getCachedOrFetch(uniqueKey(), 60_000, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ items: [1, 2, 3] });
  });

  it("serves from cache on a second call before TTL", async () => {
    const key = uniqueKey();
    const fetcher = jest.fn().mockResolvedValue({ value: "first" });

    const first = await getCachedOrFetch(key, 60_000, fetcher);
    const second = await getCachedOrFetch(key, 60_000, fetcher);

    expect(first).toEqual({ value: "first" });
    expect(second).toEqual({ value: "first" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("refetches after the TTL expires", async () => {
    const key = uniqueKey();
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce({ value: "stale" })
      .mockResolvedValueOnce({ value: "fresh" });

    const first = await getCachedOrFetch(key, -1, fetcher);
    const second = await getCachedOrFetch(key, -1, fetcher);

    expect(first).toEqual({ value: "stale" });
    expect(second).toEqual({ value: "fresh" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("propagates fetcher errors", async () => {
    const fetcher = jest.fn().mockRejectedValue(new Error("boom"));

    await expect(getCachedOrFetch(uniqueKey(), 60_000, fetcher)).rejects.toThrow("boom");
  });

  it("handles complex cache keys", async () => {
    const fetcher = jest.fn().mockResolvedValue([1]);

    const result = await getCachedOrFetch(
      "eventos-proximos?with=special-chars/ñ&ú_x001f\u0000",
      60_000,
      fetcher
    );
    expect(result).toEqual([1]);
  });
});