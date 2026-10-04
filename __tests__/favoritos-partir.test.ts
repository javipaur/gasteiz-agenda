import { partirFavoritos, yaPaso } from "@/lib/favoritos";
import { localDateKey } from "@/lib/slug";

describe("partirFavoritos", () => {
  const hoy = new Date(2027, 2, 15, 12, 0, 0); // 15 de marzo de 2027, mediodía

  it("manda a su grupo lo que ya pasó y lo que no", () => {
    const { futuros, pasados } = partirFavoritos(
      [
        { id: "futuro", date: "2027-03-20T20:00:00.000Z" },
        { id: "pasado", date: "2027-03-01T20:00:00.000Z" },
        { id: "hoy", date: "2027-03-15T20:00:00.000Z" },
      ],
      hoy
    );

    expect(futuros.map((f) => f.id)).toEqual(["hoy", "futuro"]);
    expect(pasados.map((f) => f.id)).toEqual(["pasado"]);
  });

  it("un evento de hoy sigue sin estar pasado, aunque su hora ISO sea anterior", () => {
    // El caso que hace necesaria la clave de día local: `20:00Z` en Madrid es el
    // día 16 a las 22:00, pero un evento de las 00:30 local del día 15 lleva un
    // `20:30Z` del día **14**. Comparando instantes, "hoy a las 00:30" salía como
    // pasado; comparando días, no.
    const madrugada = new Date(2027, 2, 15, 0, 30, 0).toISOString();

    expect(localDateKey(madrugada)).toBe("2027-03-15");
    expect(yaPaso(madrugada, hoy)).toBe(false);

    // Y el control: si la clave fuera el prefijo ISO, en Madrid esto daría
    // "2027-03-14" y el favorito se habría ido al grupo de pasados.
    expect(madrugada.slice(0, 10)).toBe("2027-03-14");
  });

  it("ordena por fecha dentro de cada grupo", () => {
    const { futuros, pasados } = partirFavoritos(
      [
        { id: "c", date: "2027-03-25T20:00:00.000Z" },
        { id: "a", date: "2027-03-18T20:00:00.000Z" },
        { id: "pasado-tarde", date: "2027-03-14T20:00:00.000Z" },
        { id: "pasado-pronto", date: "2027-03-02T20:00:00.000Z" },
      ],
      hoy
    );

    expect(futuros.map((f) => f.id)).toEqual(["a", "c"]);
    expect(pasados.map((f) => f.id)).toEqual(["pasado-pronto", "pasado-tarde"]);
  });

  it("una fecha ilegible va a futuros y al final, no se pierde", () => {
    const { futuros, pasados } = partirFavoritos(
      [
        { id: "roto", date: "no-es-fecha" },
        { id: "bueno", date: "2027-03-20T20:00:00.000Z" },
      ],
      hoy
    );

    expect(pasados).toHaveLength(0);
    expect(futuros.map((f) => f.id)).toEqual(["bueno", "roto"]);
  });

  it("una lista vacia se parte en dos listas vacias", () => {
    expect(partirFavoritos([], hoy)).toEqual({ futuros: [], pasados: [] });
  });
});
