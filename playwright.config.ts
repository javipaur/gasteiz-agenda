import { defineConfig, devices } from "@playwright/test";

/**
 * El puerto tiene que salir de un solo sitio.
 *
 * Antes `baseURL` usaba `E2E_BASE_URL` pero `webServer.url` llevaba el 3000
 * escrito a mano. Con `PORT=32xx` para no chocar con otro proyecto, el dev
 * server arrancaba en 32xx y Playwright se quedaba mirando el 3000 hasta
 * agotar los 180 s. Era un fallo de la suite, no del entorno: en cualquier
 * maquina con el 3000 ocupado no se podia ejecutar.
 */
const PORT = process.env.PORT || "3000";
const BASE_URL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  retries: 1,
  workers: 2,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
