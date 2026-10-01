/**
 * El baseline de `@typescript-eslint/no-explicit-any`.
 *
 * **La lista está en `lint-baseline.json`, no aquí, y no en `eslint.config.mjs`.**
 * Es un JSON porque lo consumen dos que no se entienden: ESLint lo carga desde
 * Node puro y el test lo importa con TypeScript. Un `.ts` importado desde
 * `eslint.config.mjs` funciona, pero Node lo reparsea como módulo ES y avisa por
 * consola en cada `npm run lint` —ruido en la única salida que se lee—. Y la
 * lista dentro de la config sería un inventario: se puede dejar atrás sin que
 * nadie lo note.
 *
 * **Por qué existe una lista y no un recuento.** Comparar el número de
 * problemas con el de ayer es lo más corto de escribir y lo peor de usar:
 * arreglar un `any` y añadir otro se cancelan, el número no se mueve y el rojo no
 * aparece nunca. Con una lista de ficheros, un `any` en un fichero que no está
 * es un rojo aunque el total no cambie. Eso es lo que comprueba
 * `__tests__/lint-baseline.test.ts`, corriendo ESLint de verdad.
 *
 * **Qué hay dentro, y por qué el alcance es estrecho.** Trece scrapers que leen
 * JSON o HTML sin tipar de sitios reales, un script de un solo uso, y tres rutas
 * de API que reproducen a propósito la forma cruda porque la consume un cliente
 * externo. En esos ficheros el `any` es deuda acotada: el dato entra sin forma y
 * sale tipado por `normalizeRaw`.
 *
 * Lo que **no** hay dentro es lo que da valor a la lista: ningún componente,
 * ninguna página, ningún módulo que se cargue en el navegador. Ahí un `any`
 * llega hasta la UI y sigue siendo un error. Por eso la lista no es "los
 * ficheros que ya tienen `any`" sino "los scrapers y las tres rutas de
 * contrato", y por eso añadir un componente a la lista tiene que ser un
 * `git diff` que se lee, no una línea más.
 *
 * Poner un tipo a esta deuda es trabajo de scraper, no de lint, y no estaba en
 * ninguna fase. Cuando se haga, la entrada correspondiente se borra de aquí en
 * el mismo commit, y el test de "cada exención dice por qué" avisa si se queda
 * sin motivo.
 */

export type ExencionAny = {
  /** Ruta relativa a la raíz del repo, con `/` incluso en Windows. */
  fichero: string;
  /** Por qué este fichero puede tener `any` y ningún otro. */
  razon: string;
};

export { default as ANY_PERMITIDO } from "./lint-baseline.json";