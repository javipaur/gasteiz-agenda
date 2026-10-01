import type { Config } from "jest";

/**
 * La zona se fija **aquí**, en el proceso principal, y no en un `beforeAll`.
 *
 * Es el sitio correcto por una razón concreta: este fichero se evalúa antes de
 * que Jest bifurque los workers, así que la variable llega heredada al nascent.
 * Dentro de un test ya no sirve —V8 fija la zona por isolate al arrancar el
 * worker y una asignación posterior se lee de vuelta correcta pero no cambia
 * nada—, y eso estaba medido, no supuesto.
 *
 * Sin esto, la mitad de los casos de `__tests__/agenda.test.ts` son incapacity:
 * en UTC `localDateKey(d)` y `d.slice(0, 10)` son la misma función para toda
 * fecha, así que ningún test en negro puede distinguirlas. En un runner en UTC el
 * caso de la clave de dedupe daba un verde que no protegía nada, y en el runner
 * de Dokploy —que es UTC— habría seguido igual.
 *
 * Los tests de `lib/blanca.ts` también lo necesitan: leen el año de una fecha y
 * comparan contra `getFullYear()`.
 */
process.env.TZ = "Europe/Madrid";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.jest.json",
      },
    ],
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  clearMocks: true,
  testTimeout: 30000,
};

export default config;