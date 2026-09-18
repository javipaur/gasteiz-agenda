import { AsyncLocalStorage } from "node:async_hooks";

if (typeof (globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage === "undefined") {
  (globalThis as { AsyncLocalStorage: typeof AsyncLocalStorage }).AsyncLocalStorage = AsyncLocalStorage;
}

afterEach(() => {
  jest.restoreAllMocks();
});