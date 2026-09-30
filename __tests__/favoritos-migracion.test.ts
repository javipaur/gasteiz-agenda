import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { migrateFavorites, readFavorites } from "@/app/context/favorites-migration";
import { eventSlug } from "@/lib/slug";

const ROOT = resolve(__dirname, "..");

/** Literal fijado en `__tests__/agenda.test.ts`: si se mueve, las URLs publicadas dan 404. */
const SLUG_FIJADO = "cena-de-gazt-pastor-2027-01-15-61c47k";

const UUID_VIEJO = "3f9b0a1e-2c4d-4e5f-8a9b-0c1d2e3f4a5b";

const GUARDADO_ANTIGUO = {
  id: UUID_VIEJO,
  title: "Cena de Gazt Pastor",
  date: "2027-01-15T19:00:00.000Z",
  link: "https://www.lagenterula.com/evento/cena-gazt-pastor",
  image: "https://cdn.example.com/gazt.jpg",
  location: "Vitoria-Gasteiz",
};

/** `roundTrip` es lo que hace el navegador: serializar y volver a leer. */
function roundTrip(stored: unknown): string {
  return JSON.stringify(stored);
}

describe("migración de favoritos", () => {
  it("rehace el id de un favorito guardado con UUID", () => {
    // El fallo que se arregla: `lib/eventos.ts` generaba el id con
    // `crypto.randomUUID()`, distinto en cada re-scraping, así que los favoritos
    // guardados dejaban de coincidir con el evento y el corazón volvía a estar
    // vacío. El slug se deriva de título, fecha y enlace, que sí estaban
    // guardados, así que el id se puede rehacer sin perder nada.
    const migrados = migrateFavorites([GUARDADO_ANTIGUO]);

    expect(migrados).toHaveLength(1);
    expect(migrados[0].id).toBe(SLUG_FIJADO);
    expect(migrados[0].id).not.toBe(UUID_VIEJO);
  });

  it("el id rehecho es el mismo slug que produce el agregador", () => {
    // La razón de ser de toda la función: la tarjeta enlaza con este id y
    // `/evento/[slug]` resuelve contra `AgendaEvento.slug`. Si son dos
    // funciones distintas, el enlace da 404.
    const [favorito] = migrateFavorites([GUARDADO_ANTIGUO]);
    const delAgregado = eventSlug({
      title: GUARDADO_ANTIGUO.title,
      date: GUARDADO_ANTIGUO.date,
      link: GUARDADO_ANTIGUO.link,
    });

    expect(favorito.id).toBe(delAgregado);
    expect(favorito.slug).toBe(delAgregado);
  });

  it("conserva el resto de campos del favorito", () => {
    const [favorito] = migrateFavorites([GUARDADO_ANTIGUO]);

    expect(favorito.title).toBe(GUARDADO_ANTIGUO.title);
    expect(favorito.date).toBe(GUARDADO_ANTIGUO.date);
    expect(favorito.image).toBe(GUARDADO_ANTIGUO.image);
    expect(favorito.location).toBe(GUARDADO_ANTIGUO.location);
    expect(favorito.link).toBe(GUARDADO_ANTIGUO.link);
  });

  it("es idempotente: migrar un favorito ya migrado no lo cambia", () => {
    // El segundo `useEffect` del contexto reescribe lo que hay en `localStorage`
    // en cada cambio, así que lo migrado se vuelve a leer en la siguiente
    // carga. Si la migración no fuera idempotente, cada ida y vuelta dejaría
    // algo distinto y los favoritos se irían perdiendo.
    const una = migrateFavorites([GUARDADO_ANTIGUO]);
    const dos = migrateFavorites(una);
    const tres = migrateFavorites(dos);

    expect(dos).toEqual(una);
    expect(tres).toEqual(una);
    expect(dos[0].id).toBe(una[0].id);
    expect(dos[0].slug).toBe(una[0].slug);
  });

  it("sobrevive al viaje completo por localStorage", () => {
    // Lo que de verdad pasa en el navegador: stringify, otra pestaña, y vuelta a
    // leer. Si aquí el id se moviera, el favorito desaparecería en la segunda
    // visita.
    const guardado = roundTrip([GUARDADO_ANTIGUO]);
    const primera = readFavorites(guardado);
    const segunda = readFavorites(roundTrip(primera));

    expect(segunda).toEqual(primera);
    expect(segunda[0].id).toBe(SLUG_FIJADO);
  });

  it("conserva los ya migrados sin tocarlos", () => {
    const slug = eventSlug({ title: "X", date: "2027-01-01T00:00:00.000Z", link: "" });
    const migrados = migrateFavorites([
      { id: slug, slug, title: "X", date: "2027-01-01T00:00:00.000Z" },
    ]);

    expect(migrados[0].id).toBe(slug);
    expect(migrados[0].slug).toBe(slug);
  });

  it("trata un enlace \"#\" como si no hubiera enlace", () => {
    // `normalizeRaw` del agregador descarta el `"#"` que emiten algunas fuentes.
    // Si la migración no hiciera lo mismo, un favorito guardado con `"#"` y el
    // mismo evento scraped con la URL real darían dos ids distintos.
    const conHash = migrateFavorites([
      { ...GUARDADO_ANTIGUO, id: UUID_VIEJO, link: "#" },
    ]);
    const sinLink = migrateFavorites([
      { id: UUID_VIEJO, title: GUARDADO_ANTIGUO.title, date: GUARDADO_ANTIGUO.date },
    ]);

    expect(conHash[0].id).toBe(sinLink[0].id);
    expect(conHash[0].id).toBe(
      eventSlug({ title: GUARDADO_ANTIGUO.title, date: GUARDADO_ANTIGUO.date, link: "" })
    );
  });

  it("descarta los favoritos que no se pueden recuperar", () => {
    // Sin título o sin fecha no hay forma de recalcular el slug. Inventarles un
    // id los dejaría como favoritos ghosts: cuentan en la cabecera, ocupan sitio
    // en `/favoritos` y su corazón nunca puede encenderse ni apagarse.
    expect(
      migrateFavorites([
        { id: "a", title: "", date: "2027-01-01T00:00:00.000Z" },
        { id: "b", title: "Sin fecha", date: "" },
        { id: "c" },
        GUARDADO_ANTIGUO,
      ])
    ).toHaveLength(1);
  });

  it("sobrevive a un almacenamiento corrupto o que no es una lista", () => {
    expect(readFavorites(null)).toEqual([]);
    expect(readFavorites("")).toEqual([]);
    expect(readFavorites("no es json")).toEqual([]);
    expect(readFavorites('{"no":"es una lista"}')).toEqual([]);
    expect(readFavorites("null")).toEqual([]);
    expect(readFavorites("[null, 3, \"texto\"]")).toEqual([]);
    expect(migrateFavorites(undefined)).toEqual([]);
    expect(migrateFavorites({ title: "no es una lista" })).toEqual([]);
  });

  it("conserva el orden en que se guardaron", () => {
    const otro = {
      ...GUARDADO_ANTIGUO,
      id: "otro-uuid",
      title: "Otro evento",
      date: "2027-02-01T20:00:00.000Z",
    };
    const migrados = migrateFavorites([GUARDADO_ANTIGUO, otro]);

    expect(migrados.map((f) => f.title)).toEqual([
      GUARDADO_ANTIGUO.title,
      otro.title,
    ]);
  });
});

/**
 * El otro lado del invariante: la tarjeta y el detalle tienen que resolver el
 * slug por el mismo camino. `lib/agenda.ts` es el único sitio donde un slug
 * puede nacer; el resto lo recibe ya resuelto en `AgendaEvento`.
 *
 * Antes de la unificación, siete componentes más la tarjeta recalculaban el slug
 * con `eventSlug(...)` sobre datos que ya lo traían. Funcionaba mientras
 * `eventSlug` fuera una función pura de `{title, date, link}` —y en cuanto dejara
 * de serlo, `/evento/[slug]` no encontraría nada y el 404 volvería sin que
 * ningún test lo notase. Estos dos tests son los que lo notan.
 */
const EXCEPTOXIONES: Record<string, string> = {
  "lib/slug.ts": "la definición",
  "lib/agenda.ts": "el único sitio donde nace un slug",
  "app/context/favorites-migration.ts":
    "rehacer el slug de lo que ya estaba en localStorage, que se guardó con un UUID. Su resultado tiene que coincidir con `AgendaEvento.slug`, y que coincida lo fija el literal de arriba",
  "app/components/FiestasBlancaSection.tsx":
    "recibe `FiestaBlanca` del scraper, no `AgendaEvento`",
  "app/components/FiestasBlancaPageClient.tsx":
    "recibe `FiestaBlanca` del scraper, no `AgendaEvento`",
  "app/fiestas-blanca/page.tsx": "JSON-LD de `FiestaBlanca` cruda",
  "app/conciertos/page.tsx": "`/conciertos` todavía scrapea por su cuenta",
  "app/components/ConciertosPageClient.tsx":
    "`/conciertos` todavía scrapea por su cuenta",
};

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if ([".next", ".git", "node_modules"].includes(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.tsx?$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

/**
 * Código sin comentarios. Un guard que se dispara con la documentación que él
 * mismo exige escribir es un guard que alguien acaba desactivando, así que antes
 * de buscar se quitan los comentarios. El `[^:]` del segundo patrón evita
 * comerse el `//` de un `https://` dentro de una cadena.
 */
function sinComentarios(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function recalculaElSlug(file: string): boolean {
  return /\beventSlug\s*\(/.test(sinComentarios(readFileSync(file, "utf8")));
}

function ficherosQueRecalculanElSlug(): string[] {
  return [...walk(join(ROOT, "app")), ...walk(join(ROOT, "lib"))]
    .filter(recalculaElSlug)
    .map((file) => relative(ROOT, file).replace(/\\/g, "/"))
    .sort();
}

describe("el slug se resuelve en un solo sitio", () => {
  it("las excepciones existen todas y están justificadas", () => {
    // Una excepción sin motivo escrito es deuda que nadie va a pagar, así que
    // el motivo es parte del contrato: si alguien añade una excepción nueva, tiene
    // que escribir por qué ese fichero no puede resolver el slug todavía.
    const sinMotivo = Object.entries(EXCEPTOXIONES)
      .filter(([, motivo]) => motivo.trim().length === 0)
      .map(([fichero]) => fichero);
    expect(sinMotivo).toEqual([]);

    const inexistentes = Object.keys(EXCEPTOXIONES).filter(
      (fichero) => !existsSync(join(ROOT, fichero))
    );
    expect(inexistentes).toEqual([]);
  });

  it("toda llamada a eventSlug está en la lista de excepciones conocidas", () => {
    // Este es el que duele: si alguien vuelve a pasar un evento por
    // `eventSlug(...)` en una tarjeta, este test falla diciendo en qué fichero,
    // en vez de que el 404 aparezca en producción.
    expect(ficherosQueRecalculanElSlug()).toEqual(Object.keys(EXCEPTOXIONES).sort());
  });

  it("la tarjeta enlaza con el slug resuelto, no con uno recalculado", () => {
    const source = readFileSync(join(ROOT, "lib", "shared.tsx"), "utf8");
    expect(source).toContain("`/evento/${evento.slug}`");
    expect(recalculaElSlug(join(ROOT, "lib", "shared.tsx"))).toBe(false);
  });
});
