import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Las secciones de la home y el orden en que salen.
 *
 * **Por qué un test que lee el fichero y no uno que pinta la página.** La home son
 * catorce `Suspense` con sus esqueletos, y sus componentes arrastran `next/image`,
 * scroll horizontal y animación de entrada. Un test que la pintara se ataría a
 * todo eso a la vez y se pondría rojo cada vez que se tocara un color.
 *
 * Lo que importa aquí es una cosa más pequeña y que sí se rompe: **qué secciones
 * hay y en qué orden**. Ese es el invariante, y un fichero de texto lo comprueba
 * sin arrastrar nada.
 *
 * Es el mismo enfoque que `__tests__/colores-a-mano.test.ts` y
 * `__tests__/source-data.test.ts`: leer el código para fijar una regla de composición
 * que ningún test de comportamiento va a detectar.
 */

const PAGINA = join(process.cwd(), "app", "page.tsx");
const HERO = join(process.cwd(), "app", "components", "HeroSection.tsx");
const SIGUIENTES_DIAS = join(
  process.cwd(),
  "app",
  "components",
  "NextDaysSection.tsx"
);

function fuente(): string {
  return readFileSync(PAGINA, "utf8");
}

/** La posición de la primera aparición de un texto, o -1. */
function en(texto: string, aguja: string): number {
  return texto.indexOf(aguja);
}

describe("la composición de la home", () => {
  it("ya no pinta el teaser de hoy, que era los mismos 35 eventos dos veces", () => {
    // Medido en producción el 9 de octubre de 2026: `Hoy en Gasteiz` y
    // `Próximos 7 días` tenían exactamente los mismos 35 eventos.
    // **Se mira el uso y no la mención**: el comentario que explica por qué se
    // quitó tiene que poder decir `TodayStrip`.
    expect(fuente()).not.toMatch(/^\s*import .*\bTodayStrip\b/m);
    expect(fuente()).not.toMatch(/<TodayStrip/);
  });

  it("el componente del teaser se borra del repo, no solo deja de pintarse", () => {
    expect(() =>
      readFileSync(join(process.cwd(), "app", "components", "TodayStrip.tsx"), "utf8")
    ).toThrow();
  });

  it("la puerta es identidad y buscador, sin tarjetas que luego se repitan", () => {
    // El hero tenía tres destacados y, debajo, la rejilla y el riel volvían a
    // pintarlos. Medido el 23 de octubre de 2026, doce tarjetas de la última
    // sección eran las doce de la anterior.
    const hero = readFileSync(HERO, "utf8");
    expect(hero).toMatch(/<HeroSearch/);
    expect(hero).not.toMatch(/getPopularEvents/);
    expect(hero).not.toMatch(/<HeroCard/);
    expect(fuente()).not.toMatch(/^\s*import .*\bHeroCard\b/m);
  });

  it("los tres bloques centrales van por preguntas: hoy, recomendados, semana", () => {
    // Quien llega sin saber qué hacer pregunta primero cuándo, después qué
    // merece la pena, y solo entonces quiere todo lo que hay. Antes los
    // recomendados salían antes que el día y el día se pintaba dos veces.
    const texto = fuente();
    const hoy = en(texto, "<TodayWithData />");
    const recomendados = en(texto, "<TopWithData />");
    const semana = en(texto, "<NextDaysWithData />");

    expect(hoy).toBeGreaterThan(-1);
    expect(recomendados).toBeGreaterThan(hoy);
    expect(semana).toBeGreaterThan(recomendados);
  });

  it("«Próximos 7 días» no ofrece hoy como pestaña", () => {
    // El bloque «Hoy en Vitoria» ya lo responde. Dejar la pestaña aquí pintaría
    // los mismos planes dos veces en la misma pantalla.
    const src = readFileSync(SIGUIENTES_DIAS, "utf8");
    expect(src).toMatch(/for \(let i = 1; i < 7; i\+\+\)/);
    expect(src).not.toMatch(/>Hoy</);
  });

  it("los partidos bajan al bloque de categorías", () => {
    const texto = fuente();
    expect(en(texto, "<PartidosSection />")).toBeGreaterThan(
      en(texto, "<NextDaysWithData />")
    );
  });

  it("se Van las tres puertas repetidas a las categorías y la prueba social", () => {
    // `SectionsHub` era la tercera puerta a las mismas categorías y hacía su
    // propio `getPeliculas()`. `AtAGlanceStrip` ponía siete chips que repetían
    // el resumen del hero, `MoodFilter` otra rejilla y `SocialProof` un cuarto
    // sitio con el mismo número de planes.
    const texto = fuente();
    for (const nombre of [
      "AtAGlanceStrip",
      "SectionsHub",
      "MoodFilter",
      "SocialProof",
    ]) {
      expect(texto).not.toMatch(new RegExp(`^\\s*import .*\\b${nombre}\\b`, "m"));
      expect(texto).not.toMatch(new RegExp(`<${nombre}\\b`));
    }
  });

  it("ninguna sección con eventos se pinta dos veces", () => {
    const usos = [...fuente().matchAll(/<Suspense[^>]*>\s*<([A-Z][A-Za-z]*)WithData\s*\/>/g)].map(
      (m) => m[1]
    );
    const repetidos = usos.filter((u, i) => usos.indexOf(u) !== i);
    expect(repetidos).toEqual([]);
  });

  it("el banner de instalación sigue sobre el primer bloque de agenda", () => {
    // Medido en producción: al final de la agenda el botón caía a 9.776 px en
    // móvil. Arriba es donde se ve; esa decisión no cambia con el rediseño.
    const texto = fuente();
    expect(en(texto, "<InstallBanner />")).toBeGreaterThan(
      en(texto, "<HeroWithData />")
    );
    expect(en(texto, "<InstallBanner />")).toBeLessThan(
      en(texto, "<TodayWithData />")
    );
  });

  it("la última sección no repite la semana: usa lo de después", () => {
    // Antes recibía la agenda entera y hacía slice(0,12), así que las doce tarjetas
    // eran las mismas que las de «Próximos 7 días». Ahora corta con partirEnSemana
    // y pasa solo lo posterior al corte, con el enlace a la agenda por mes.
    const src = fuente();
    const eventos = en(src, "<EventsWithData />");
    const despues = en(src, "partirEnSemana");
    const mesHref = en(src, 'mesHref={`/agenda/${localDateStr(new Date(ahora)).slice(0, 7)}`}');
    expect(eventos).toBeGreaterThan(-1);
    expect(despues).toBeGreaterThan(-1);
    expect(mesHref).toBeGreaterThan(-1);
  });
});
