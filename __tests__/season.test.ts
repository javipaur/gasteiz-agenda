import { getAccentSeason } from "@/lib/season";

function d(m: number, day: number) {
  return new Date(2026, m - 1, day);
}

describe("getAccentSeason", () => {
  it("navidades: 20 dic – 6 ene", () => {
    expect(getAccentSeason(d(12, 20))).toBe("navidad");
    expect(getAccentSeason(d(12, 24))).toBe("navidad");
    expect(getAccentSeason(d(12, 31))).toBe("navidad");
    expect(getAccentSeason(d(1, 1))).toBe("navidad");
    expect(getAccentSeason(d(1, 6))).toBe("navidad");
  });

  it("san prudencia: 26–29 abr", () => {
    expect(getAccentSeason(d(4, 26))).toBe("san-prudencio");
    expect(getAccentSeason(d(4, 28))).toBe("san-prudencio");
    expect(getAccentSeason(d(4, 29))).toBe("san-prudencio");
  });

  it("la blanca: 4–9 ago", () => {
    expect(getAccentSeason(d(8, 4))).toBe("blusas");
    expect(getAccentSeason(d(8, 5))).toBe("blusas");
    expect(getAccentSeason(d(8, 9))).toBe("blusas");
  });

  it("primavera: 20 mar – 20 jun", () => {
    expect(getAccentSeason(d(3, 20))).toBe("primavera");
    expect(getAccentSeason(d(4, 20))).toBe("primavera");
    expect(getAccentSeason(d(6, 20))).toBe("primavera");
  });

  it("verano: 21 jun – 22 sep", () => {
    expect(getAccentSeason(d(6, 21))).toBe("verano");
    expect(getAccentSeason(d(8, 3))).toBe("verano");
    expect(getAccentSeason(d(9, 22))).toBe("verano");
  });

  it("otoño: 23 sep – 19 dic", () => {
    expect(getAccentSeason(d(9, 23))).toBe("otono");
    expect(getAccentSeason(d(11, 15))).toBe("otono");
    expect(getAccentSeason(d(12, 19))).toBe("otono");
  });

  it("invierno: 7 ene – 19 mar", () => {
    expect(getAccentSeason(d(1, 7))).toBe("invierno");
    expect(getAccentSeason(d(2, 14))).toBe("invierno");
    expect(getAccentSeason(d(3, 19))).toBe("invierno");
  });
});