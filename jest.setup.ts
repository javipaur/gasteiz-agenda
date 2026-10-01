import { AsyncLocalStorage } from "node:async_hooks";

if (typeof (globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage === "undefined") {
  (globalThis as { AsyncLocalStorage: typeof AsyncLocalStorage }).AsyncLocalStorage = AsyncLocalStorage;
}

/**
 * React 19 se niega a correr `act()` sin este flag, y avisa por consola con
 * "The current testing environment is not configured to support act(...)" en vez
 * de fallar. Ese aviso se cuela en la salida de las 45 suites de node, que no
 * renderizan nada, así que solo se pone cuando hay un test de componente.
 *
 * Va en un `beforeEach` con condición en lugar de en el cuerpo del fichero
 * porque leerlo de aquí lo evalúa Jest al cargar el setup, que es antes de que el
 * entorno de un fichero con `@jest-environment jsdom` esté montado.
 */
beforeEach(() => {
  if (typeof document !== "undefined") {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
  }
});

afterEach(() => {
  jest.restoreAllMocks();
});