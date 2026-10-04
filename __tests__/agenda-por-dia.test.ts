import { agruparPorDiaLocal, type AgendaEvento } from "@/lib/agenda";
import { localDateKey } from "@/lib/slug";

/**
 * Agrupar por el día que ve el usuario.
 *
 * Este test existe por un fallo que era invisible en la pantalla: `/agenda/[mes]`
 * seleccionaba el mes con getters locales —`getFullYear()`, `getMonth()`— y luego
 * agrupaba los días con `toISOString().slice(0, 10)`, que es el día **UTC**. En
 * Europe/Madrid la medianoche local son las 22:00 o las 23:00 del día anterior, así
 * que la página elegía bien el mes y luego ponía cada evento bajo el encabezado del
 * día anterior.
 *
 * Lo que lo hace se ven en el propio test: `scrapeSenderismo` emite
 * `new Date(y, m-1, d).toISOString()`, o sea exactamente la clase de cadena que
 * rompe. Con el prefijo ISO, el 15 de enero sale como 14.
 *
 * Y al revés que en UTC, donde `localDateKey(d)` y `d.slice(0, 10)` son la misma
 * función para toda fecha y el test no podría detectar una regresión. Por eso
 * `process.env.TZ = "Europe/Madrid"` está en `jest.config.ts`, y por eso aquí hay un
 * aviso si el runner dejara de estar en una zona al este.
 */

function evento(over: Partial<AgendaEvento>): AgendaEvento {
  return {
    id: "id",
    slug: "slug",
    title: "Evento",
    date: "2027-01-15T20:00:00.000Z",
    location: "Vitoria-Gasteiz",
    link: "https://example.com/a",
    category: "Otros",
    source: "municipal-agenda",
    ...over,
  };
}

/** La cadena que emite `lib/sources/senderismo.ts`: medianoche local pasada por UTC. */
function medianocheLocal(year: number, mes: number, dia: number): string {
  return new Date(year, mes - 1, dia, 0, 0, 0).toISOString();
}

describe("agruparPorDiaLocal", () => {
  it("agrupa por el día local, no por el prefijo ISO", () => {
    const medianoche = medianocheLocal(2027, 1, 15);

    // Si el runner estuviera en UTC o al oeste, las dos funciones serían iguales y
    // este test no podría distinguir la implementación buena de un `slice(0, 10)`
    // colado. Se avisa en vez de fallar, porque el sitio correcto del aviso es
    // `huso.test.ts`, que convierte el `console.warn` en un rojo.
    if (localDateKey(medianoche) === medianoche.slice(0, 10)) {
      console.warn(
        "[agenda-por-dia] AVISO: el runner no está al este de UTC, así que este " +
          "test no puede detectar una regresión a `slice(0, 10)`. Zona: " +
          Intl.DateTimeFormat().resolvedOptions().timeZone
      );
    }

    const porDia = agruparPorDiaLocal([evento({ date: medianoche })]);

    expect([...porDia.keys()]).toEqual(["2027-01-15"]);
    // Y el control: el prefijo ISO de esa misma cadena da el día 14.
    expect(medianoche.slice(0, 10)).toBe("2027-01-14");
  });

  it("un evento de madrugada se queda en su día, no en el anterior", () => {
    // 00:30 del día 15 en Madrid es 23:30Z del día 14. Con la clave UTC caería en
    // un grupo que el usuario no está mirando.
    const madrugada = medianocheLocal(2027, 1, 15);
    const conHora = new Date(2027, 0, 15, 0, 30, 0).toISOString();

    const porDia = agruparPorDiaLocal([
      evento({ slug: "madrugada", date: madrugada }),
      evento({ slug: "manana", date: conHora }),
    ]);

    expect([...porDia.keys()]).toEqual(["2027-01-15"]);
    expect(porDia.get("2027-01-15")).toHaveLength(2);
  });

  it("separa días distintos y ordena por día", () => {
    const porDia = agruparPorDiaLocal([
      evento({ slug: "b", date: medianocheLocal(2027, 1, 20) }),
      evento({ slug: "a", date: medianocheLocal(2027, 1, 15) }),
      evento({ slug: "c", date: medianocheLocal(2027, 1, 20) }),
    ]);

    expect([...porDia.keys()]).toEqual(["2027-01-15", "2027-01-20"]);
    expect(porDia.get("2027-01-20")?.map((e) => e.slug)).toEqual(["b", "c"]);
  });

  it("mantiene el orden de aggregate dentro de cada día", () => {
    // `Map` conserva el orden de inserción y `aggregate` entrega los eventos
    // ordenados por fecha, así que las claves salen en orden y dentro de un día no
    // hay nada que reordenar.
    const porDia = agruparPorDiaLocal([
      evento({ slug: "primero", date: medianocheLocal(2027, 1, 15) }),
      evento({ slug: "segundo", date: medianocheLocal(2027, 1, 15) }),
    ]);

    expect(porDia.get("2027-01-15")?.map((e) => e.slug)).toEqual(["primero", "segundo"]);
  });

  it("una fecha ilegible cae en su propio grupo en vez de romper la página", () => {
    // `localDateKey` devuelve "sin-fecha" en lugar de lanzar. Una excepción aquí
    // tiraría la página entera del mes, que es un 500 por un dato.
    const porDia = agruparPorDiaLocal([
      evento({ slug: "roto", date: "no-es-fecha" }),
      evento({ slug: "bueno", date: medianocheLocal(2027, 1, 15) }),
    ]);

    expect(porDia.has("sin-fecha")).toBe(true);
    expect(porDia.get("sin-fecha")?.[0].slug).toBe("roto");
    expect(porDia.size).toBe(2);
  });

  it("una lista vacía no inventa un grupo", () => {
    expect(agruparPorDiaLocal([]).size).toBe(0);
  });
});
