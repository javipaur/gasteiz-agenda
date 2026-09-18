# Plan: Tests + Error Tracking para Gasteiz Click

## Contexto

La aplicación no tiene ningún test (Jest, Playwright config, fixtures). Los 14 scrapers dependen de HTML/JSON externo sin validación. Errores en producción solo van a `console.error` (32 instancias) y se pierden.

## Tracks

### Track 2: Testing Infrastructure (Jest + Playwright)

**Dependencias a instalar:**
```
npm install -D jest ts-jest @types/jest
```

**Archivos a crear:**

| Archivo | Propósito |
|---------|-----------|
| `jest.config.ts` | Config Jest: ts-jest preset, moduleNameMapper `@/` → root, testMatch |
| `tsconfig.jest.json` | Extiende tsconfig.json, override `module: commonjs`, `moduleResolution: node` |
| `jest.setup.ts` | afterEach con jest.restoreAllMocks() |
| `__tests__/fixtures/fever-listing.html` | HTML real de feverup.com |
| `__tests__/fixtures/gasteizhoy-listing.html` | HTML real de gasteizhoy.com |
| `__tests__/fixtures/rula-response.json` | JSON real de la API MEC de lagenterula |
| `__tests__/fixtures/vam-response.json` | JSON real de app.vamcultura.es |
| `__tests__/fixtures/municipal-response.json` | JSON real de la API del ayuntamiento |
| `__tests__/fixtures/jimmyjazz-listing.html` | HTML real de jimmyjazz.es |
| `__tests__/fixtures/helldorado-listing.html` | HTML real de helldorado |
| `__tests__/fixtures/musikaze-listing.html` | HTML real de musikaze |
| `__tests__/fixtures/euskadi-response.json` | JSON real de opendata.euskadi |
| `__tests__/sources/fever.test.ts` | Test scraper Fever |
| `__tests__/sources/gasteizhoy.test.ts` | Test scraper GasteizHoy |
| `__tests__/sources/rula.test.ts` | Test scraper Rula |
| `__tests__/sources/vam.test.ts` | Test scraper VAM |
| `__tests__/sources/municipal.test.ts` | Test scraper Municipal |
| `__tests__/sources/jimmyjazz.test.ts` | Test scraper JimmyJazz |
| `__tests__/sources/helldorado.test.ts` | Test scraper HellDorado |
| `__tests__/sources/musikaze.test.ts` | Test scraper Musikaze |
| `__tests__/sources/euskadi.test.ts` | Test scraper Euskadi |
| `__tests__/eventos.test.ts` | Test de normalizeEvento + deduplicación |
| `__tests__/cache.test.ts` | Test de getCachedOrFetch |
| `__tests__/categories.test.ts` | Test de normalización de categorías |
| `__tests__/popularity.test.ts` | Test del algoritmo de scoring |
| `playwright.config.ts` | Config Playwright: webServer next dev, baseURL |
| `e2e/homepage.spec.ts` | Load homepage, ver eventos |
| `e2e/api.spec.ts` | GET /api/v1/events retorna datos válidos |

**package.json scripts:**
```json
"test": "jest",
"test:watch": "jest --watch",
"test:coverage": "jest --coverage",
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

**Nota importante:** `lib/sources/rula.ts` tiene un token MEC hardcodeado (línea 2) — **no subir a pública**. Considerar moverlo a env var.

### Track 3: Error Tracking con Axiom

**Dependencias:**
```
npm install @axiomhq/next.js
```

**Cambios:**
1. `next.config.ts` — envolver con `withAxiom()`
2. `app/error.tsx` — capturar excepción client-side con Axiom
3. Env vars: `NEXT_PUBLIC_AXIOM_DATA_TOKEN`, `AXIOM_INGEST_KEY`
4. Login de scrapers: log de fallos por fuente con contexto

## Orden de implementación

1. Instalar jest + dependencias
2. Config jest (jest.config.ts, tsconfig.jest.json, jest.setup.ts)
3. Añadir scripts en package.json
4. Capturar fixtures reales (fetch de cada fuente)
5. Crear tests de scrapers
6. Crear tests de utilidades
7. Configurar Playwright + tests E2E
8. Instalar y configurar Axiom
9. Verificación final: `npm test`, `npm run lint`, `npm run build`