import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Por qué esta regla y no un guard propio.
 *
 * La primera versión de la tarea 8 tenía un test que caminaba el árbol buscando
 * `eventSlug(` y comparaba el resultado con una lista de excepciones. Parecía
 * suficiente y no lo era: `import { eventSlug as sl }` se colaba, porque un
 * `import` renombrado es lo primero que hace alguien al resolver un conflicto de
 * nombres, y el guard le daba falsa confianza; además miraba por fichero, no por
 * llamada, y no cubría `scripts/`.
 *
 * `no-restricted-imports` con `importNames` sigue al símbolo por el nombre
 * importado, no por el nombre local, así que el renombrado deja de ser un
 * agujero. Y quien necesite el slug de un evento crudo pasa por `agendaSlug`, que
 * aplica la misma normalización que `normalizeRaw` (trim del título, `#` como
 * enlace vacío) y es la única forma de que un favorito migrado, una tarjeta de
 * La Blanca y el evento del agregado acaben con el mismo id.
 */
const MENSAJE_EVENT_SLUG =
  'No importes `eventSlug` directamente: normaliza antes con `agendaSlug` de ' +
  '`@/lib/slug`, que aplica el trim del título y descarta el "#" igual que ' +
  '`normalizeRaw`. Si ya tienes un `AgendaEvento`, usa su campo `slug`. ' +
  '(`eventSlug` es la primitiva; llamarla a pelo es como se produjo el 404 que ' +
  'esta regla previene.)';

/**
 * Todo lo que exporta `lib/slug.ts`. En los ficheros con permiso sale la lista
 * explícita en vez de "cualquiera": si mañana se añade una sexta función, hay
 * que decidir aquí si se permite en vez de que se colen todas por sorpresa.
 */
const EXPORTACIONES_SLUG = [
  "slugify",
  "localDateKey",
  "eventSlug",
  "agendaLink",
  "agendaSlug",
];

/**
 * La regla, en sus dos formas.
 *
 * Se construye por función porque las dos necesitan exactamente el mismo
 * `paths`/`patterns` y sólo cambia qué nombres se literacycitan: si las dos
 * copias se escribieran a mano, la excepción acabaría aplicando a menos de lo que
 * dice su comentario. Y `importNames` y `allowImportNames` no pueden convivir en
 * la misma entrada —el schema lo prohíbe—, así que la forma con permiso usa la
 * variante "todo menos estos nombres", que es la que trae `allowImportNames`.
 *
 * `@/lib/slug` va en `paths` y los relativos en `patterns`, porque son dos
 * mechanisms distintos: `lib/agenda.ts` importa de `"./slug"`, así que una regla
 * que sólo mirara el alias dejaría un camino abierto. El `regex` de `patterns` se
 * ancla a los relativos a propósito: con un glob que también casara con el alias
 * cada importación recibiría dos avisos del mismo.
 */
function reglaEventSlug(permitidos = false) {
  const nombres = permitidos
    ? { allowImportNames: EXPORTACIONES_SLUG }
    : { importNames: ["eventSlug"] };
  return [
    "error",
    {
      paths: [{ name: "@/lib/slug", ...nombres, message: MENSAJE_EVENT_SLUG }],
      patterns: [
        { regex: "^\\.{1,2}/.*slug(\\.ts)?$", ...nombres, message: MENSAJE_EVENT_SLUG },
      ],
    },
  ];
}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Skills y agentes instalados, no son codigo del proyecto:
    ".agents/**",
    ".opencode/**",
    ".claude/**",
    ".superpowers/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
  {
    // `__tests__` se queda fuera a propósito: los tests de contrato fijan el
    // comportamiento de `eventSlug` y `agendaSlug` llamándolos, y un test de
    // componente necesitará montar un fixture. Lo que no se permite es que el código
    // que se despliega recalcule el slug por su cuenta.
    files: ["app/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "scripts/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": reglaEventSlug(),
    },
  },
  {
    // Las dos únicas excepciones, y son deuda con fecha: `/conciertos` todavía
    // scrapea por su cuenta con `scrapeAllConciertos()` y pone ids con
    // `crypto.randomUUID()`, así que sus eventos no salen del agregador y no hay
    // slug resuelto que copiar. Se borran juntas cuando `/conciertos` filtre el
    // agregado; el diagnóstico está en
    // `.superpowers/sdd/2026-09-30-agenda-unificada/briefs/task-8-report.md`.
    files: ["app/conciertos/page.tsx", "app/components/ConciertosPageClient.tsx"],
    rules: {
      "no-restricted-imports": reglaEventSlug(true),
    },
  },
]);

export default eslintConfig;
