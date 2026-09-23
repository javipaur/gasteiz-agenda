import { esHoy, esEsteFinde, esEstaSemana, getAtAGlance, formatFechaViva } from "@/lib/at-a-glance";

// 2026-09-23 es miércoles. Finde de la semana: sáb 26 y dom 27.
const NOW = new Date(2026, 8, 23, 12, 0, 0);

describe("esHoy", () => {
  it("true for the same local day, false otherwise", () => {
    expect(esHoy("2026-09-23", NOW)).toBe(true);
    expect(esHoy("2026-09-22", NOW)).toBe(false);
    expect(esHoy("2026-09-24", NOW)).toBe(false);
    expect(esHoy("no-date", NOW)).toBe(false);
  });
});

describe("esEsteFinde", () => {
  it("counts only Saturday and Sunday inside the next 7 days", () => {
    expect(esEsteFinde("2026-09-26", NOW)).toBe(true); // sáb
    expect(esEsteFinde("2026-09-27", NOW)).toBe(true); // dom
    expect(esEsteFinde("2026-09-25", NOW)).toBe(false); // vie
    expect(esEsteFinde("2026-09-24", NOW)).toBe(false); // jue
    expect(esEsteFinde("2026-10-03", NOW)).toBe(false); // fuera de la ventana
    expect(esEsteFinde("no-date", NOW)).toBe(false);
  });
});

describe("esEstaSemana", () => {
  it("counts days from today to +6", () => {
    expect(esEstaSemana("2026-09-23", NOW)).toBe(true);
    expect(esEstaSemana("2026-09-29", NOW)).toBe(true);
    expect(esEstaSemana("2026-09-30", NOW)).toBe(false);
    expect(esEstaSemana("2026-09-22", NOW)).toBe(false);
    expect(esEstaSemana("no-date", NOW)).toBe(false);
  });
});

describe("getAtAGlance", () => {
  it("aggregates counters and formats the live date", () => {
    const eventos = [
      { id: "a", title: "A", date: "2026-09-23" },
      { id: "b", title: "B", date: "2026-09-23" },
      { id: "c", title: "C", date: "2026-09-26" },
      { id: "d", title: "D", date: "2026-09-29" },
      { id: "e", title: "E", date: "2026-10-15" },
    ] as never;
    const r = getAtAGlance(eventos, NOW);
    expect(r.hoy).toBe(2);
    expect(r.finde).toBe(1);
    expect(r.semana).toBe(4);
    expect(r.fechaLabel).toBe("miércoles, 23 sept");
  });
});

describe("formatFechaViva", () => {
  it("renders spanish weekday + day + month", () => {
    expect(formatFechaViva(NOW)).toBe("miércoles, 23 sept");
  });
});