# Spec: Vista por categoría individual en la app nativa

**Owner-decisión:** Javier. **Ejecutable por:** desarrollo en próxima iteración.

## Goal
Permitir filtrar la app nativa por categoría de agenda cultural (las 15 taxonómicas de web, agrupadas en los 6 ejes: cultural / familia / movimiento / vida diaria / fiestas / turismo), porque hoy `ListCategorias.tsx` solo muestra 4 accesos directos del lado operativo (transpo/bus/car races/pharmacies) y la agenda cultural no se filtra.

## Decisión de producto propuesta (pendiente de aprobación)
**NO igualar el recorte de la portada** entre web y nativa. El web's portada es curaduría editorial (4–6 tarjetas por "momento": hoy/esta semana/…"Nuestros equipos"/"La Blanca"). El nativo es instrumento de consulta ("yo quiero ver Category X"): la view por categoría individual favorece la nativa y no resta funcionalidad al web.

## Acceptance criteria (front-end en React Native)
1. Nueva ruta `CategoryScreen` en `navigator` que acepta `categoryId` (web's id from normalized `category`).
2. Endpoint de la web `/api/actividades/*` o un nuevo `/api/categorias/:slug`: devolver eventos por category.
3. UI: header con nombre de categoría + color de la chips web (`lib/tokens.json` color per axis, `Colors` cromáctico existing), list of events (re-use `ItemEventsOpenData.tsx` component), loading/skeleton, empty-state copy using `NoResults`.
4. Cuadro "hoy/esta semana" toggle inline.
5. `ListCategorias.tsx` con 6 ejes canónicos (cultural, familia, movimiento, vida diaria, fiestas, turismo) + sin emoji-based icons (consider icons web-real) — aprobación pendiente.

## Back-end (web)
- `lib/categories.ts` 15 taxa already maps via `normalizeCategory`, `tag` second axis.
- Add `/api/actividades/categoria/:slug` returning `{ source, items[] }` aligned.
- `CUENTA DE VOLUMEN`: exposición de un read limit (e.g. 50 items por paginación)? Optional paginación infinite scroll.

## Test coverage
- `__tests__/api/` route test (existing test `api/actividades-agenda.test.ts` as precedent).
- RN side Jest 33→? Basic snapshot test de screen.<|end|>