import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";

import { migrateFavorites, readFavorites } from "@/app/context/favorites-migration";
import { aggregate } from "@/lib/agenda";
import { agendaSlug, eventSlug } from "@/lib/slug";
import type { SourceEntry } from "@/lib/source-registry";

const ROOT = resolve(__dirname, "..");
const ESLINT_BIN = join(ROOT, "node_modules", "eslint", "bin", "eslint.js");

/** Una entrada de registro mínima, como en `__tests__/agenda.test.ts`. */
function entry(over: Partial<Omit<SourceEntry, "run">> & Pick<SourceEntry, "run">): SourceEntry {
  return { id: "test", group: "test", label: "Test", priority: 9, ...over };
}

type LintError = { ruleId: string | null; message: string; line: number };
type LintResult = { messages: { ruleId: string | null; message: string; line: number }[] };

/**
 * ESLint de verdad, con la configuración de verdad, en un proceso aparte.
 *
 * Dos motivos para no usar la API `new ESLint()`: `eslint.config.mjs` es ESM y
 * Jest compila a CommonJS, así que la carga dinámica del config revienta con
 * `A dynamic import callback was invoked without --experimental-vm-modules`; y
 * un proceso limpio no arrastra a Jest la tentación de parchear la config en
 * memoria, que es justo lo que haría inútil este test.
 *
 * `--stdin` con `--stdin-filename` da un lint de verdad sin escribir un solo
 * fichero en el repo: ESLint resuelve la configuración por la ruta, exista o no.
 */
function ejecutar(args: string[], input?: string): string {
  try {
    return execFileSync(process.execPath, [ESLINT_BIN, ...args], {
      cwd: ROOT,
      input,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch (error) {
    // ESLint sale con código 1 cuando encuentra errores, que es justo el caso
    // que nos interesa. Su informe sigue saliendo por stdout.
    const stdout = (error as { stdout?: string }).stdout;
    if (stdout) return stdout;
    throw error;
  }
}

function mensajesDe(salida: string): LintError[] {
  const [resultado] = JSON.parse(salida) as LintResult[];
  return resultado.messages.map((m) => ({ ruleId: m.ruleId, message: m.message, line: m.line }));
}

function lintar(codigo: string, filePath = "app/components/__probe.ts"): LintError[] {
  return mensajesDe(
    ejecutar(["--stdin", "--stdin-filename", filePath, "--format", "json"], codigo)
  );
}

/** Lint de un fichero real del repo, con su ruta de verdad. */
function lintarFicheroReal(relPath: string): LintError[] {
  return mensajesDe(ejecutar([relPath, "--format", "json"]));
}

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
    const delAgregado = agendaSlug({
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
      agendaSlug({ title: GUARDADO_ANTIGUO.title, date: GUARDADO_ANTIGUO.date, link: "" })
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

  it("descarta los favoritos con una fecha que no es una fecha", () => {
    // `normalizeRaw` rechaza `date: "roto"` con un `isNaN(new Date(...))`. Sin el
    // mismo criterio aquí, la migración le pondría un id a un evento que el
    // agregador nunca emitió: `localDateKey` devuelve `"sin-fecha"` y el slug
    // acaba en `...-sin-fecha-a1b2c3`, un fantasma más.
    expect(
      migrateFavorites([
        { id: "a", title: "Evento roto", date: "roto" },
        { id: "b", title: "Sin día", date: "2027-13-45" },
        GUARDADO_ANTIGUO,
      ])
    ).toHaveLength(1);
  });

  it("migra al mismo id que el agregado cuando el título viene con espacios", async () => {
    // El P0 sobreviviendo. `normalizeRaw` recorta el título y la migración no lo
    // hacía. Como `eventSlug` hashea el título **crudo**, la parte legible del
    // slug era idéntica y lo único que se movía eran los 6 caracteres del hash:
    //
    //   agregado  (con trim) cena-de-gazt-pastor-2027-01-15-61c47k
    //   migración (sin trim) cena-de-gazt-pastor-2027-01-15-g56scw
    //
    // Las dos cadenas apuntan a `/evento/<algo que ya no existe>`, así que a un
    // favorito de cualquier fuente que emita el título sin recortar -`municipal`,
    // `rula`, `buscametas`, `helldorado` y `fiestas-blanca` lo hacen- la
    // migración le devuelve un id que no coincide con ningún evento. El corazón se
    // apaga solo, que es justo lo que esta tarea arregla.
    const crudo = {
      title: "  Cena de Gazt Pastor  ",
      date: "2027-01-15T19:00:00.000Z",
      link: "https://www.lagenterula.com/evento/cena-gazt-pastor",
    };

    const [delAgregado] = await aggregate([entry({ run: async () => [crudo] })]);
    const [migrado] = migrateFavorites([{ id: UUID_VIEJO, ...crudo }]);

    expect(migrado.id).toBe(delAgregado.slug);
    expect(migrado.id).toBe(SLUG_FIJADO);
  });

  it("el recorte del título no es un detalle cosmético", async () => {
    // Si `agendaSlug` no recortara, el test de arriba pasaría por el mismo motivo
    // que pasaba antes: los dos lados harían lo mismo mal. Este comprueba que las
    // dos reglas son distintas, para que el de arriba no pueda volverse vacuuo.
    const crudo = {
      title: "  Cena de Gazt Pastor  ",
      date: "2027-01-15T19:00:00.000Z",
      link: "https://www.lagenterula.com/evento/cena-gazt-pastor",
    };
    const [delAgregado] = await aggregate([entry({ run: async () => [crudo] })]);

    expect(delAgregado.slug).toBe(SLUG_FIJADO);
    expect(eventSlug(crudo)).not.toBe(SLUG_FIJADO);
  });

  it("normaliza igual que el agregado cuando el enlace viene en `url`", async () => {
    // La forma que emite `scrapeFiestasBlanca`: `url` y `timeStart`, sin `link`.
    // El agregado lo resuelve en `normalizeRaw`; la migración solo tiene `link`,
    // así que la paridad se comprueba con las dos entradas de la misma fuente.
    const conUrl = { title: "Verbena", date: "2027-08-04T20:00:00.000Z", url: "https://x.com/b" };
    const conLink = { title: "Verbena", date: "2027-08-04T20:00:00.000Z", link: "https://x.com/b" };
    const [delAgregado] = await aggregate([entry({ run: async () => [conUrl] })]);
    const [conEnlace] = await aggregate([entry({ run: async () => [conLink] })]);

    expect(delAgregado.slug).toBe(conEnlace.slug);
    expect(agendaSlug(conUrl)).toBe(agendaSlug(conLink));
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
 * slug por el mismo camino. `lib/agenda.ts` decide el `id`; el resto lo recibe ya
 * resuelto en `AgendaEvento`, y quien tenga un evento crudo pasa por `agendaSlug`.
 *
 * Eso no se comprueba con un guard propio. La primera versión de esta tarea
 * caminaba el árbol buscando `eventSlug(` y comparaba con una lista de
 * excepciones, y tenía dos agujeros: `import { eventSlug as sl }` pasando a
 * `sl(ev)` se colaba, porque un `import` renombrado es lo primero que hace
 * alguien al renombrar algo por un conflicto de nombres; y el guard no cubría
 * `scripts/`. Los dos están cerrados ahora por `no-restricted-imports` con
 * `importNames` en `eslint.config.mjs`, que sigue al símbolo por el nombre
 * importado y no por el local. Este bloque comprueba que la regla está puesta y
 * que muerde.
 */
describe("la regla de ESLint que prohíbe recalcular el slug", () => {
  it("señala un import directo de eventSlug", () => {
    const mensajes = lintar(
      'import { eventSlug } from "@/lib/slug";\n' +
        'export const href = (e: { title: string; date: string; link?: string }) =>\n' +
        "  `/evento/${eventSlug(e)}`;\n"
    );
    expect(mensajes.map((m) => m.ruleId)).toEqual(["no-restricted-imports"]);
  });

  it("también señala un import renombrado", () => {
    // El agujero del guard anterior, encontrado en revisión. Si esto pasa, la
    // regla está mal puesta y volvería a dar falsa confianza.
    const mensajes = lintar(
      'import { eventSlug as sl } from "@/lib/slug";\n' +
        'export const href = (e: { title: string; date: string; link?: string }) =>\n' +
        "  `/evento/${sl(e)}`;\n"
    );
    expect(mensajes.map((m) => m.ruleId)).toEqual(["no-restricted-imports"]);
  });

  it("también señala un import relativo", () => {
    // `lib/agenda.ts` importa de `"./slug"`, así que una regla que sólo mirara
    // `"@/lib/slug"` dejaría un camino abierto.
    const mensajes = lintar(
      'import { eventSlug } from "./slug";\n' +
        'export const href = (e: { title: string; date: string; link?: string }) =>\n' +
        "  `/evento/${eventSlug(e)}`;\n",
      "lib/__probe.ts"
    );
    expect(mensajes.map((m) => m.ruleId)).toEqual(["no-restricted-imports"]);
  });

  it("no señala a quien usa agendaSlug", () => {
    const mensajes = lintar(
      'import { agendaSlug } from "@/lib/slug";\n' +
        "export const slug = (f: { title: string; date: string; url: string }) => agendaSlug(f);\n"
    );
    expect(mensajes).toEqual([]);
  });

  it("no señala a quien usa el slug ya resuelto", () => {
    const mensajes = lintar(
      'import type { Evento } from "@/lib/eventos";\n' +
        "export const href = (e: Evento) => `/evento/${e.slug}`;\n"
    );
    expect(mensajes).toEqual([]);
  });

  it("las excepciones de /conciertos siguen permitidas", () => {
    // `/conciertos` todavía scrapea por su cuenta, así que sus dos ficheros son
    // los únicos con permiso, y el permiso está en el bloque de
    // `eslint.config.mjs` que los nombra uno a uno. Si se le añade un tercero sin
    // tocar la regla, este test no lo ve, pero `npx eslint` sí.
    for (const file of ["app/conciertos/page.tsx", "app/components/ConciertosPageClient.tsx"]) {
      expect(lintarFicheroReal(file)).toEqual([]);
    }
  });
});
