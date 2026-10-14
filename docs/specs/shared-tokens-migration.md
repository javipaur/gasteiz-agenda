# Spec: Migración a tokens compartidos (single source of truth)

**Owner-decisión:** Javier (atomizado, ejecutar último). **High risk — touch both stacks; do in stages.**

## Goal
Que `lib/tokens.json` sea **la única fuente** (actualmente sólo documented) consumida por Tailwind v4 (`@theme`) y by `appTheme.tsx`. Cambiar el color/escala en `tokens.json` propagation con un commit atomado en ambos repos.

## Restricciones arquitectónicas
- Tailwind v4 es CSS-first: `@theme` plain CSS, no importa JSON. Para consumir JSON se necesita preprocessor stage (build-time).
- `app/globals.css` es bytes literal. Si lo generamos, source-of-truth tree cambiar.
- `appTheme.tsx` en RN compile standalone.

## Stages (in order; cada uno es rollback/mutable)

### Stage A — Make both adapters read from one *copy*, not from literals
- Copy `lib/tokens.json` into rn `theme/tokens.json` (sync script, cron or pre-build copy).
- Update web `app/globals.css @theme` colors to **re-use same `var()`** (CSS vars are single source of literals that tokens.json documents). Document = exact match (no extra delta).
- Update `appTheme.tsx` to `require('./tokens.json')` for colors/radii/spacing; expose `colors`, `spacing`, `radius`, `fonts`, `typography` derived.
- **Validation:** tsc zero, tests pass, visual pixel-equal on web & RN for 3 representative screens.

### Stage B — Build time generator for web (no change to dev, only build)
- Add `scripts/gen-css-tokens.ts` that emits `app/tokens.generated.css` from `lib/tokens.json`.
- Tailwind config via `@import './tokens.generated.css'` before `@theme`.
- CI check ( lint / build gate): diff prevents drift.
- **Validation:** diff of `app/tokens.generated.css` should be `git clean` after running script. If not, `npm run doctor` would catch.

### Stage C — RN consumes JSON at runtime
- `const tokens = require('./tokens.json')` is already runtime-only (rn requires at loader time; Webpack/Metro bundles as string).
- Full refactor of `appTheme.tsx` derived fields.
- RN tsc + jest must pass.
- **Validation:** snapshot of `tokens` object vs `lib/tokens.json` (checksum).

### Edge cases
- Version fields in JSON (like `"meta.generated"`) for drift detection.
- Primary color of PWA `theme_color` in manifest vs accent: update both or accept divergence driven by OKLCH dark-mode contrast (`#BC0202` on `#0B0E14`).
- Auth/SEO meta color tags are in `app/layout.tsx` meta — keep consistent by ref web.

## Open question to OIL7-project owner
- ¿Stage B genera el CSS en `app/` (so Atlas re-export) o en `public/` (so github Action remote-app)? Recomendado: `app/tokens.generated.css` y `gitignore`? No — commit it, then check identical on CI.<|end|>