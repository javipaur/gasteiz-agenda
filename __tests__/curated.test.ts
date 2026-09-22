import { getCurated, mapsLink } from "@/lib/curated";

describe("mapsLink", () => {
  it("genera URL de Google Maps a partir de coords", () => {
    expect(mapsLink({ lat: 42.8508, lng: -2.6731 })).toBe(
      "https://www.google.com/maps/search/?api=1&query=42.8508,-2.6731"
    );
  });

  it("devuelve undefined sin coords", () => {
    expect(mapsLink()).toBeUndefined();
  });
});

describe("getCurated", () => {
  it("lee un JSON curado existente", async () => {
    const data = await getCurated<{ name: string }>("fixtures/curated-test.json");
    expect(data.name).toBe("ok");
  });
});