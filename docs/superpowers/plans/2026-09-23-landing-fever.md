# Home Fever-inspired (Part 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repintar la home de Gasteiz Click al lenguaje Fever (oscura por defecto, vibrante, gradientes, titulares Archivo en mayúscula, pills de color) sobre la estructura actual de 12 secciones, añadiendo la franja "de un vistazo", tarjeta destacada en el hero y cifras reales con métrica de deporte — sin tocar la lógica de datos existente.

**Architecture:** Cambio de piel global = reescritura de tokens en `app/globals.css` (oscuro base + variante "bright" clara con el toggle existente auto/light/dark) + fuente Archivo en `app/layout.tsx` + repintado de los componentes de la home. Los datos, el ciclo de vida de componentes (EventCard, NextDaysSection, MoodFilter, TopEventsSection), `revalidate 300` e interior de páginas no cambian: reaprovechan los tokens. Solo hay lógica nueva pura en `lib/at-a-glance.ts` (contadores), con TDD.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript estricto, Tailwind CSS v4 (tokens CSS vía `@theme inline`, custom props), `next/font/google` (Archivo), Jest (ts-jest, `__tests__/**/*.test.ts`, alias `@/`), Playwright (`e2e/*.spec.ts` contra `npm run dev`), patrón `cache()` + `getCachedOrFetch` para datos. Shell: Windows PowerShell 5.1 (no «&&»).

**Spec:** `docs/superpowers/specs/2026-09-23-landing-deporte-reels-design.md` (§2 "Home Fever-inspired", §Testing). El plan argumenta desde ese spec; el ejecutor lee ambos.

## Global Constraints

- Modo **oscuro por defecto**; el claro es variante "bright" de la misma marca. El toggle `ThemeToggle` (Footer, `auto`/`light`/`dark`) sigue funcionando: `:root` = tokens oscuros (base), `:root[data-theme="light"]` = variante clara, media query `prefers-color-scheme: light` para usuarios sin JS en modo auto. No romper `auto` (system).
- Tipografía: **Archivo** (variable, normal+italic) sustituye a Fraunces (display) y Montserrat (body). **JetBrains Mono** se mantiene para las líneas meta. Los kickers serif itálicos se convierten en **pills de color** con texto en mono/mayúsculas.
- Paleta viva: `--hot #FF4D7D`, `--violet #7B4DFF`, `--teal #00D2C8`, `--amber #FFB300`, `--lime #9BFF57` (deporte). El acento principal de temporada sigue sobreviviendo (bloques `[data-accent="..."]` transpuestos a oscuro-primero).
- Estructura de la home (12 bloques) y orden actual se conservan; únicos añadidos: `AtAGlanceStrip` (tras el hero) y la tarjeta destacada del hero. `revalidate 300` intacto. La **lógica** de EventCard / NextDaysSection / MoodFilter / TopEventsSection se conserva; solo cambia la piel.
- Cats: `lib/categories.ts` `CATEGORY_COLORS` y `CATEGORY_FILLS` se reasignan a la paleta saturada. Nada de dependencias nuevas.
- Conservación (spec §2.4): `e2e/homepage.spec.ts` actual (título, `[banner]`, `Navegación principal`, `a[href^='/evento/']`, nav a `/conciertos`, heading `Nuestros equipos en acción`, link `/deporte`, detalle de evento) debe seguir pasando sin editar sus asserts. Se **añaden** asserts nuevos por tarea.
- Frenos de calidad (rulings del SDD Parte 1): gate de `npm run lint` = los **archivos tocados por este plan añaden 0 hallazgos** (el baseline del repo tiene ~302 problemas pre-existentes y no es gate); `npx jest` permite única falla conocida pre-existente `gastronomia.test.ts` (Expected >=3 zonas, Received 2 — data drift ajeno); regex/moibake: los strings en español van **con acentos correctos** (PowerShell no corrompe si se usan los editores; no pegar texto mojibake).
- Paquetes de revisión del SDD: en PowerShell 1) `git status --porcelain`, 2) `git diff --stat` , 3) `git diff -U10` para revisar el diff real, no echo de git (los acentos viajan bien en el tool result). No redirigir a archivos con PowerShell (UTF-16/mojibake): usar `Read` del archivo si hace falta.
- E2e corre contra `npm run dev` (playwright webserver ya configurado, baseURL localhost:3000). Windows: usar `npx playwright test e2e/homepage.spec.ts` (nada de `&&`).

---

## File Structure

**Crear:**
- `lib/at-a-glance.ts` — contadores puros `hoy` / `finde` / `semana` + `formatFechaViva` (lógica nueva; único código con tests unitarios).
- `app/components/AtAGlanceStrip.tsx` — franja "de un vistazo" (server): fecha viva + contadores + chips por categoría.
- `app/components/SectionHead.tsx` — cabecera de sección Fever común (pill de tag + título Archivo + subtítulo + link "ver todo").

**Modificar:**
- `app/globals.css` — reescritura del bloque de tokens (oscuro base + claro bright + acentos transpuestos + color-scheme + utility `.text-accent` + `.aurora`; se retira `.hero-grid`).
- `app/layout.tsx` — Archivo sustituye Fraunces/Montserrat; `viewport.themeColor` oscuro `#0B0E14`.
- `lib/categories.ts` — valores nuevos de `CATEGORY_COLORS` y `CATEGORY_FILLS`.
- `lib/shared.tsx` — pill de categoría sólida en `EventCard` (texto oscuro, borde redondeado).
- `app/components/HeroSection.tsx` — H1 Archivo mayúscula + aurora + tarjeta "Plan destacado" (desktop).
- `app/components/SectionsHub.tsx` — repintado de tarjetas Fever + header con `SectionHead`.
- `app/components/TodayStrip.tsx`, `app/components/NextDaysSection.tsx`, `app/components/MoodFilter.tsx` — header con `SectionHead`.
- `app/components/CategoryCarousel.tsx` — header con `SectionHead` (props nuevas `tag` / `tagColor`).
- `app/components/TopEventsSection.tsx` — header con `SectionHead` (se conserva el clúster de flechas).
- `app/components/HomeEventsClient.tsx`, `app/components/FiestasBlancaSection.tsx` — header con `SectionHead`.
- `app/components/PartidosSection.tsx` — header con `SectionHead` + retoque de tarjetas.
- `app/components/SocialProof.tsx` — "Gasteiz Click en cifras" + FreshnessBadge + métrica de deporte + datos reales.
- `app/components/NewsLetter.tsx` — panel de dos tonos con gradiente (lógica intacta).
- `app/page.tsx` — insertar `AtAGlanceStrip` tras el hero; pasar datos reales a `SocialProof`.
- `__tests__/categories.test.ts` — añadir asserts del nuevo mapeo de colores (mantener los existentes: siguen pasando, solo validan formato hex).
- `e2e/homepage.spec.ts` — añadir describe/tests nuevos (tema oscuro por defecto + toggle, pills, franja, cifras/deporte).

---

### Task 1: Tokens Fever + tipografía Archivo (oscuro por defecto)

**Files:**
- Modify: `app/globals.css` (bloque `:root` a `@theme inline` + `html` color-scheme + `.aurora`/`.hero-grid` + utilities finales)
- Modify: `app/layout.tsx:16-34` (fonts), `app/layout.tsx:94-104` (viewport)
- Test: `e2e/homepage.spec.ts` (nuevos asserts de tema)

**Interfaces:**
- Produces: tokens `--color-bg`…, `--color-accent`, `--color-teal`, `--color-amber`, y **nuevos** `--color-hot`, `--color-violet`, `--color-lime` (@theme inline); clase utilitaria `.aurora`; variable de fuente `--font-archivo` (display/body). Los demás tasks las consumen.

- [ ] **Step 1: Reemplazar el bloque de tokens en `app/globals.css`**

Sustituir TODO lo comprendido entre `:root {` (línea 3) y el cierre del último bloque `@media (prefers-color-scheme: dark)` (hoy línea 111) por este código (oscuro base + claro bright):

```css
:root {
  --bg: #0B0E14;
  --bg-muted: #141821;
  --bg-elevated: #1B2130;
  --fg: #F6F5F3;
  --fg-muted: #A6B0BD;
  --fg-subtle: #7C8794;
  --border: #2A3345;
  --border-hover: #3B4458;
  --accent: #FF4D7D;
  --accent-hover: #FF7A9E;
  --accent-ink: #FFD2DE;
  --accent-subtle: #3A1626;
  --accent-soft: rgba(255, 77, 125, 0.16);
  --surface: #1B2130;
  --surface-hover: #222A3B;
  --hot: #FF4D7D;
  --violet: #7B4DFF;
  --teal: #00D2C8;
  --amber: #FFB300;
  --lime: #9BFF57;
  --green: var(--lime);
  --blue: #4D7BFF;
  --teal-soft: rgba(0, 210, 200, 0.14);
  --bezel-highlight: rgba(255, 255, 255, 0.05);
  --bezel-shadow: rgba(0, 0, 0, 0.4);
  --bezel-hover: rgba(0, 0, 0, 0.6);
  --accent-wash: rgba(255, 77, 125, 0.12);
  --teal-wash: rgba(0, 210, 200, 0.10);
  --violet-wash: rgba(123, 77, 255, 0.12);
  --amber-wash: rgba(255, 179, 0, 0.10);
  --lime-wash: rgba(155, 255, 87, 0.10);
  --sec-accent: var(--accent-ink);
  --sec-hot: #FF9DB4;
  --sec-violet: #B9A1FF;
  --sec-teal: #4FE6DC;
  --sec-amber: #FFCB4D;
  --sec-lime: #B6FF8A;
  --sec-blue: #8FA9FF;
  --sec-hot-fill: #E83662;
  --sec-violet-fill: #6B32DA;
  --sec-teal-fill: #00B8AE;
  --sec-amber-fill: #E8A32E;
  --sec-lime-fill: #7ADB39;
  --sec-blue-fill: #5B78E8;
}

:root[data-theme="light"] {
  --bg: #F7F6F4;
  --bg-muted: #EEEDEB;
  --bg-elevated: #FFFFFF;
  --fg: #0C1016;
  --fg-muted: #4A565F;
  --fg-subtle: #7C8794;
  --border: #E2E4E8;
  --border-hover: #C8CDD4;
  --accent: #FF4D7D;
  --accent-hover: #E53363;
  --accent-ink: #E53363;
  --accent-subtle: #FFE4EC;
  --accent-soft: rgba(255, 77, 125, 0.10);
  --surface: #FFFFFF;
  --surface-hover: #F1F1EF;
  --hot: #FF4D7D;
  --violet: #6B32FF;
  --teal: #009E96;
  --amber: #B87F00;
  --lime: #68B82E;
  --green: #3F8F35;
  --blue: #3357D6;
  --teal-soft: rgba(0, 158, 150, 0.12);
  --bezel-highlight: rgba(255, 255, 255, 0.7);
  --bezel-shadow: rgba(12, 16, 22, 0.06);
  --bezel-hover: rgba(12, 16, 22, 0.18);
  --accent-wash: rgba(255, 77, 125, 0.08);
  --teal-wash: rgba(0, 158, 150, 0.08);
  --violet-wash: rgba(107, 50, 255, 0.08);
  --amber-wash: rgba(184, 127, 0, 0.08);
  --lime-wash: rgba(104, 184, 46, 0.10);
  --sec-accent: #E53363;
  --sec-hot: #FF4D7D;
  --sec-violet: #6B32FF;
  --sec-teal: #009E96;
  --sec-amber: #B87F00;
  --sec-lime: #68B82E;
  --sec-blue: #3357D6;
  --sec-hot-fill: #FF4D7D;
  --sec-violet-fill: #6B32FF;
  --sec-teal-fill: #009E96;
  --sec-amber-fill: #B87F00;
  --sec-lime-fill: #68B82E;
  --sec-blue-fill: #3357D6;
}

@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) {
    --bg: #F7F6F4;
    --bg-muted: #EEEDEB;
    --bg-elevated: #FFFFFF;
    --fg: #0C1016;
    --fg-muted: #4A565F;
    --fg-subtle: #7C8794;
    --border: #E2E4E8;
    --border-hover: #C8CDD4;
    --accent: #FF4D7D;
    --accent-hover: #E53363;
    --accent-ink: #E53363;
    --accent-subtle: #FFE4EC;
    --accent-soft: rgba(255, 77, 125, 0.10);
    --surface: #FFFFFF;
    --surface-hover: #F1F1EF;
    --hot: #FF4D7D;
    --violet: #6B32FF;
    --teal: #009E96;
    --amber: #B87F00;
    --lime: #68B82E;
    --green: #3F8F35;
    --blue: #3357D6;
    --teal-soft: rgba(0, 158, 150, 0.12);
    --bezel-highlight: rgba(255, 255, 255, 0.7);
    --bezel-shadow: rgba(12, 16, 22, 0.06);
    --bezel-hover: rgba(12, 16, 22, 0.18);
    --accent-wash: rgba(255, 77, 125, 0.08);
    --teal-wash: rgba(0, 158, 150, 0.08);
    --violet-wash: rgba(107, 50, 255, 0.08);
    --amber-wash: rgba(184, 127, 0, 0.08);
    --lime-wash: rgba(104, 184, 46, 0.10);
    --sec-accent: #E53363;
    --sec-hot: #FF4D7D;
    --sec-violet: #6B32FF;
    --sec-teal: #009E96;
    --sec-amber: #B87F00;
    --sec-lime: #68B82E;
    --sec-blue: #3357D6;
    --sec-hot-fill: #FF4D7D;
    --sec-violet-fill: #6B32FF;
    --sec-teal-fill: #009E96;
    --sec-amber-fill: #B87F00;
    --sec-lime-fill: #68B82E;
    --sec-blue-fill: #3357D6;
  }
}
```

- [ ] **Step 2: Transponer los bloques de acento de temporada a oscuro-primero**

El fichero sigue teniendo los bloques viejos `:root[data-theme="dark"]` y la media query que los forzaba. Para **cada** acento (`invierno`, `primavera`, `verano`, `navidad`, `san-prudencio`, `blusas`):

1. **Eliminar** el bloque `:root[data-theme="dark"][data-accent="X"]` y su media query `prefers-color-scheme: dark` correspondiente.
2. **Promover** a `:root[data-accent="X"]` (sin cualificador de tema) exactamente las variables del bloque oscuro que hoy vive en `[data-theme="dark"][data-accent="X"]` (p. ej. `invierno` → `--accent-ink: #7FA6CE; --accent-hover: #4575AC; --accent-subtle: #14243A; --accent-soft: rgba(69,117,172,0.16); --accent-wash: rgba(46,93,143,0.14);`). Si ese bloque oscuro no definía `--accent`, no lo defines (queda el base `--hot`).
3. **Crear** `:root[data-theme="light"][data-accent="X"]` con las variables del bloque claro que hoy vive en `:root[data-accent="X"]` (p. ej. `invierno` → `--accent: #2E5D8F; --accent-hover: #24486F; --accent-subtle: #E3EAF3; --accent-soft: rgba(46,93,143,0.10); --accent-wash: rgba(46,93,143,0.07);`).
4. **Duplicar** ese bloque claro dentro de `@media (prefers-color-scheme: light) { :root:not([data-theme="dark"])[data-accent="X"] { … } }`.

El resultado debe dejar el fichero sin ninguna media query `prefers-color-scheme: dark`. Ejemplo completo terminado para `invierno`:

```css
:root[data-accent="invierno"] {
  --accent-ink: #7FA6CE;
  --accent-hover: #4575AC;
  --accent-subtle: #14243A;
  --accent-soft: rgba(69, 117, 172, 0.16);
  --accent-wash: rgba(46, 93, 143, 0.14);
}
:root[data-theme="light"][data-accent="invierno"] {
  --accent: #2E5D8F;
  --accent-hover: #24486F;
  --accent-subtle: #E3EAF3;
  --accent-soft: rgba(46, 93, 143, 0.10);
  --accent-wash: rgba(46, 93, 143, 0.07);
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"])[data-accent="invierno"] {
    --accent: #2E5D8F;
    --accent-hover: #24486F;
    --accent-subtle: #E3EAF3;
    --accent-soft: rgba(46, 93, 143, 0.10);
    --accent-wash: rgba(46, 93, 143, 0.07);
  }
}
```

- [ ] **Step 3: Actualizar la font map, las nuevas utilidades y el color-scheme en `app/globals.css`**

En `@theme inline` (dentro del bloque actual):
- Añadir las filas: `--color-hot: var(--hot);`, `--color-violet: var(--violet);`, `--color-lime: var(--lime);`; y cambiar `--color-teal-soft: rgba(31, 157, 148, 0.12);` → `--color-teal-soft: var(--teal-soft);`.
- Cambiar las dos filas de fuentes:
```css
  --font-display: var(--font-archivo), system-ui, sans-serif;
  --font-body: var(--font-archivo), system-ui, sans-serif;
  --font-mono: var(--font-jetbrains-mono), monospace;
```

En `@layer base`, sustituir el bloque de `color-scheme`:

```css
  html {
    color-scheme: dark;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  html[data-theme="light"] {
    color-scheme: light;
  }

  @media (prefers-color-scheme: light) {
    html:not([data-theme="dark"]) {
      color-scheme: light;
    }
  }
```

En `@layer components`, **eliminar** el bloque `.hero-grid` completo (líneas 400-410) y **añadir** la utilidad aurora:

```css
  .aurora {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(42rem 20rem at 85% -8%, color-mix(in srgb, var(--violet) 24%, transparent), transparent 62%),
      radial-gradient(34rem 18rem at 8% 18%, color-mix(in srgb, var(--hot) 20%, transparent), transparent 60%),
      radial-gradient(42rem 22rem at 52% 112%, color-mix(in srgb, var(--teal) 16%, transparent), transparent 60%);
  }
```

Al final del fichero, sustituir los dos bloques `@layer utilities` de `.text-accent` (hoy: `html[data-theme="dark"] .text-accent` + media dark) por:

```css
@layer utilities {
  .text-accent {
    color: var(--accent-ink);
  }
  html[data-theme="light"] .text-accent {
    color: var(--accent);
  }
}
@media (prefers-color-scheme: light) {
  @layer utilities {
    :root:not([data-theme="dark"]) .text-accent {
      color: var(--accent);
    }
  }
}
```

- [ ] **Step 4: Fuente Archivo en `app/layout.tsx`**

Sustituir los imports `import { Fraunces, Montserrat, JetBrains_Mono }` por `import { Archivo, JetBrains_Mono }`; sustituir los dos bloque `const fraunces = …` y `const montserrat = …` por un único:

```tsx
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
  style: ["normal", "italic"],
  weight: "variable",
});
```

En `<html>`, cambiar `className={...}` a:

```tsx
      className={`${archivo.variable} ${jetbrainsMono.variable}`}
```

En `viewport.themeColor`, cambiar el segundo color oscuro `#141110` → `#0B0E14`:

```tsx
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FF4D7D" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0E14" },
  ],
...
```

- [ ] **Step 5: Escribir los asserts de tema (falla en rojo primero) y verificar**

Run:
`npx playwright test e2e/homepage.spec.ts`
Expected: los 5 tests actuales verdes (la home sigue completa) **y** este nuevo test falla (no existe):

Añadir al final de `e2e/homepage.spec.ts` (mismo `test.describe("Homepage")` si quieres, o un nuevo describe):

```ts
test.describe("Fever theme", () => {
  test("defaults to dark and the toggle still switches to light", async ({ page }) => {
    await page.goto("/");
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgb(11, 14, 20)");

    const lightBtn = page.getByRole("button", { name: "Tema claro" });
    await lightBtn.click();
    await page.waitForFunction(() =>
      getComputedStyle(document.body).backgroundColor === "rgb(247, 246, 244)"
    );

    const darkBtn = page.getByRole("button", { name: "Tema oscuro" });
    await darkBtn.click();
    await page.waitForFunction(() =>
      getComputedStyle(document.body).backgroundColor === "rgb(11, 14, 20)"
    );
  });
});
```

- [ ] **Step 6: Verificar el tema, el build y commitear**

Run `npx playwright test e2e/homepage.spec.ts` → 6/6 verdes.
Run `npx next build` → build OK (sin errores de fuentes ni CSS).
Run `npx eslint app/globals.css app/layout.tsx e2e/homepage.spec.ts` → 0 hallazgos (el lint solo cubre TS; los .css/.tsx sí van por eslint: `npx eslint app/layout.tsx e2e/homepage.spec.ts`; `globals.css` no entra en eslint-config-next, sáltalo en el check).

```bash
git add app/globals.css app/layout.tsx e2e/homepage.spec.ts
git commit -m "feat(home): fever token system, Archivo font, dark-by-default"
```

---

### Task 2: Paleta de categorías Fever + pills en EventCard

**Files:**
- Modify: `lib/categories.ts:67-101`
- Modify: `lib/shared.tsx:172-193` (pill de categoría)
- Test: `__tests__/categories.test.ts` (añadir asserts)
- Test: `e2e/homepage.spec.ts` (assert de card)

**Interfaces:**
- Consumes: tokens de Task 1.
- Produces: `CATEGORY_COLORS`/`CATEGORY_FILLS` reasignados a la paleta saturada (consumidos por `EventCard`, `SectionsHub`, `MoodFilter`, `NextDaysSection`, `FiestasBlancaSection`). La pill de `EventCard` pasa a ser fondo sólido + texto oscuro.

- [ ] **Step 1: Escribir el test de la paleta (rojo)**

Añadir dentro de `describe("CATEGORY_COLORS", ...)` de `__tests__/categories.test.ts`:

```ts
  it("uses the saturated fever palette", () => {
    expect(CATEGORY_COLORS["Música"]).toBe("#FF4D7D");
    expect(CATEGORY_COLORS["Teatro"]).toBe("#7B4DFF");
    expect(CATEGORY_COLORS["Cine"]).toBe("#FFB300");
    expect(CATEGORY_COLORS["Deporte"]).toBe("#9BFF57");
    expect(CATEGORY_COLORS["Otros"]).toBe("#7C8794");
  });
```

Run `npx jest __tests__/categories.test.ts` → FAIL (valores viejos).

- [ ] **Step 2: Reasignar la paleta en `lib/categories.ts`**

Sustituir por completo `CATEGORY_COLORS` y `CATEGORY_FILLS`:

```ts
export const CATEGORY_COLORS: Record<string, string> = {
  Música: "#FF4D7D",
  Teatro: "#7B4DFF",
  Cine: "#FFB300",
  Exposiciones: "#FF8A3D",
  Infantil: "#00D2C8",
  Deporte: "#9BFF57",
  Danza: "#FF6FD8",
  Festival: "#FF4D7D",
  Conferencias: "#7B4DFF",
  Fiestas: "#FF4D7D",
  Visitas: "#00D2C8",
  Talleres: "#FF8A3D",
  Gastronomía: "#FFB300",
  Senderismo: "#9BFF57",
  Otros: "#7C8794",
};

export const CATEGORY_FILLS: Record<string, string> = {
  Música: "#FF4D7D",
  Teatro: "#6B32DA",
  Cine: "#E8A32E",
  Exposiciones: "#E8742A",
  Infantil: "#00B8AE",
  Deporte: "#7ADB39",
  Danza: "#EB53C4",
  Festival: "#FF4D7D",
  Conferencias: "#6B32DA",
  Fiestas: "#FF4D7D",
  Visitas: "#00B8AE",
  Talleres: "#E8742A",
  Gastronomía: "#E8A32E",
  Senderismo: "#7ADB39",
  Otros: "#565E68",
};
```

Run `npx jest __tests__/categories.test.ts` → PASS (formato hex + valores nuevos).

- [ ] **Step 3: Test e2e de la card con tag (establece el contrato visual)**

Añadir al describe `"Homepage"`:

```ts
  test("renders event cards with a colored category pill", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const firstCard = page.locator("a[href^='/evento/']").first();
    await expect(firstCard).toBeVisible({ timeout: 30_000 });
    const pill = firstCard.locator(".e2e-cat-pill").first();
    await expect(pill).toBeVisible();
    const bg = await pill.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toMatch(/rgb/);
  });
```

Run → FAIL (la clase `.e2e-cat-pill` no existe aún).

- [ ] **Step 4: Pill sólida en `lib/shared.tsx` (EventCard)**

En el bloque del tag de categoría (líneas ~175-186), sustituir el `<span>` interno por:

```tsx
                  <span
                    className="e2e-cat-pill font-mono text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: catColor, color: "#0B0E14" }}
                  >
                    {evento.category}
                  </span>
```

(El `borderRadius: "3px"` y `color: white` + sufijo `CC` de opacidad se eliminan; la clase e2e-ancla `.e2e-cat-pill` solo existe para el assert y no afecta al estilo.)

- [ ] **Step 5: Verificar y commitear**

Run `npx jest __tests__/categories.test.ts` → PASS.
Run `npx playwright test e2e/homepage.spec.ts` → todos verdes (incl. el nuevo).
Run `npx eslint lib/categories.ts lib/shared.tsx __tests__/categories.test.ts e2e/homepage.spec.ts` → 0 hallazgos.

```bash
git add lib/categories.ts lib/shared.tsx __tests__/categories.test.ts e2e/homepage.spec.ts
git commit -m "feat(home): fever category palette and solid event pills"
```

---

### Task 3: `SectionHead` común + cabeceras de Hoy / 7 días / Moods

**Files:**
- Create: `app/components/SectionHead.tsx`
- Modify: `app/components/TodayStrip.tsx:14-22` (cabecera)
- Modify: `app/components/NextDaysSection.tsx:123-137` (cabecera)
- Modify: `app/components/MoodFilter.tsx:108-116` (cabecera)
- Test: `e2e/homepage.spec.ts`

**Interfaces:**
- Produces (contrato consumido por Tasks 6, 7 y 8):

```tsx
<SectionHead
  tag?: string
  title: string
  subtitle?: string
  href?: string
  linkLabel?: string   // default "Ver todo"
  color?: string       // color de fondo del tag pill (default var(--accent))
/>
```

- [ ] **Step 1: Crear `app/components/SectionHead.tsx`**

```tsx
import Link from "next/link";

export default function SectionHead({
  tag,
  title,
  subtitle,
  href,
  linkLabel = "Ver todo",
  color,
}: {
  tag?: string;
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
  color?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
      <div>
        {tag && (
          <span
            className="inline-flex items-center font-mono text-[11px] font-bold uppercase tracking-[0.18em] px-3 py-1 rounded-full"
            style={{ backgroundColor: color ?? "var(--accent)", color: "#0B0E14" }}
          >
            {tag}
          </span>
        )}
        <h2 className="font-display text-2xl md:text-4xl font-black uppercase tracking-[-0.03em] text-fg leading-none mt-3">
          {title}
        </h2>
        {subtitle && <p className="text-fg-muted mt-2 text-sm">{subtitle}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className="group inline-flex items-center gap-1.5 text-sm font-semibold text-fg hover:text-accent transition-colors duration-300"
        >
          {linkLabel}
          <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-0.5">→</span>
        </Link>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Aplicar en `TodayStrip` (mantiene el rail)**

Reemplazar el `div` de cabecera (doble `div` con `aria-label` y el `flex items-center gap-2 mb-4` interior) por:

```tsx
      <SectionHead tag="Hoy" title="Hoy en Gasteiz" color="var(--lime)" />
```

Conservar `aria-label="Eventos de hoy"` en la `<section>` y todo el rail de chips tal cual.

- [ ] **Step 3: Aplicar en `NextDaysSection`**

Reemplazar el bloque `InViewWrapper` que contiene `Próximos 7 días` (cabecera + `<p>` de descripción, líneas 125-137) por:

```tsx
      <InViewWrapper>
        <SectionHead
          tag="Esta semana"
          title="Próximos 7 días"
          subtitle="Planes confirmados en los próximos días en Vitoria-Gasteiz."
          color="var(--teal)"
        />
      </InViewWrapper>
```

Añadir `SectionHead` al import de `app/components/NextDaysSection.tsx` (`import SectionHead from "./SectionHead";`).

- [ ] **Step 4: Aplicar en `MoodFilter`**

Reemplazar el `InViewWrapper` con `¿Qué te apetece?` (líneas 110-116) por:

```tsx
        <InViewWrapper>
          <SectionHead tag="Moods" title="¿Qué te apetece?" color="var(--violet)" />
        </InViewWrapper>
```

Añadir el import correspondiente.

- [ ] **Step 5: Asserts e2e de las cabeceras (rojo primero) y verificar**

Añadir al describe `"Homepage"` de `e2e/homepage.spec.ts`:

```ts
  test("shows the fever section headers across the home", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /Hoy en Gasteiz/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /Próximos 7 días/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /¿Qué te apetece\?/i })).toBeVisible();
  });
```

Run `npx playwright test e2e/homepage.spec.ts` → verdes (los 3 headings ya se renderizaban; el test confirma que el cambio de cabecera no rompió los textos que ya existían). Si algún heading tarda, el `timeout` del primero lo cubre.
Run `npx jest` → sin fallos nuevos (k su única falla pre-existente `gastronomia.test.ts`).
Run `npx eslint app/components/SectionHead.tsx app/components/TodayStrip.tsx app/components/NextDaysSection.tsx app/components/MoodFilter.tsx e2e/homepage.spec.ts` → 0 hallazgos.

```bash
git add app/components/SectionHead.tsx app/components/TodayStrip.tsx app/components/NextDaysSection.tsx app/components/MoodFilter.tsx e2e/homepage.spec.ts
git commit -m "feat(home): section heads for today, nextdays, moods"
```

---

### Task 4: Franja "de un vistazo" (`AtAGlanceStrip`)

**Files:**
- Create: `lib/at-a-glance.ts`
- Create: `__tests__/at-a-glance.test.ts`
- Create: `app/components/AtAGlanceStrip.tsx`
- Modify: `app/page.tsx` (insertar tras el hero, pasando datos)
- Test: `e2e/homepage.spec.ts`

**Interfaces:**
- Consumes: `getProximosPartidos(1)` de `@/lib/partidos`, `getProximosEventos` (cache compartido), `CATEGORY_COLORS`/`normalizeCategory` de `@/lib/categories`, `Evento` de `@/lib/eventos`.
- Produces:
```ts
type AtAGlance = { hoy: number; finde: number; semana: number; fechaLabel: string };
esHoy(dateStr: string, now: Date): boolean
esEsteFinde(dateStr: string, now: Date): boolean
esEstaSemana(dateStr: string, now: Date): boolean
formatFechaViva(date: Date): string
getAtAGlance(eventos: Evento[], now?: Date): AtAGlance
```
`AtAGlanceStrip` props: `{ eventos: Evento[]; partidos: number }`.

- [ ] **Step 1: Escribir los tests (rojo)**

Crear `__tests__/at-a-glance.test.ts`:

```ts
import { esHoy, esEsteFinde, esEstaSemana, getAtAGlance, formatFechaViva } from "@/lib/at-a-glance";

// 2026-09-23 es miércoles. Finde de la semana: sáb 26 y dom 27.
const NOW = new Date(2026, 8, 23, 12, 0, 0);

describe("esHoy", () => {
  it("true for the same local day, false otherwise", () => {
    expect(esHoy("2026-09-23", NOW)).toBe(true);
    expect(esHoy("2026-09-22", NOW)).toBe(false);
    expect(esHoy("2026-09-24", NOW)).toBe(false);
    expect(esHoy("no-date", NOW)).toBe(false);
  });
});

describe("esEsteFinde", () => {
  it("counts only Saturday and Sunday inside the next 7 days", () => {
    expect(esEsteFinde("2026-09-26", NOW)).toBe(true); // sáb
    expect(esEsteFinde("2026-09-27", NOW)).toBe(true); // dom
    expect(esEsteFinde("2026-09-25", NOW)).toBe(false); // vie
    expect(esEsteFinde("2026-09-24", NOW)).toBe(false); // jue
    expect(esEsteFinde("2026-10-03", NOW)).toBe(false); // fuera de la ventana
    expect(esEsteFinde("no-date", NOW)).toBe(false);
  });
});

describe("esEstaSemana", () => {
  it("counts days from today to +6", () => {
    expect(esEstaSemana("2026-09-23", NOW)).toBe(true);
    expect(esEstaSemana("2026-09-29", NOW)).toBe(true);
    expect(esEstaSemana("2026-09-30", NOW)).toBe(false);
    expect(esEstaSemana("2026-09-22", NOW)).toBe(false);
    expect(esEstaSemana("no-date", NOW)).toBe(false);
  });
});

describe("getAtAGlance", () => {
  it("aggregates counters and formats the live date", () => {
    const eventos = [
      { id: "a", title: "A", date: "2026-09-23" },
      { id: "b", title: "B", date: "2026-09-23" },
      { id: "c", title: "C", date: "2026-09-26" },
      { id: "d", title: "D", date: "2026-09-29" },
      { id: "e", title: "E", date: "2026-10-15" },
    ] as never;
    const r = getAtAGlance(eventos, NOW);
    expect(r.hoy).toBe(2);
    expect(r.finde).toBe(1);
    expect(r.semana).toBe(4);
    expect(r.fechaLabel).toBe("miércoles, 23 sept");
  });
});

describe("formatFechaViva", () => {
  it("renders spanish weekday + day + month", () => {
    expect(formatFechaViva(NOW)).toBe("miércoles, 23 sept");
  });
});
```

Run `npx jest __tests__/at-a-glance.test.ts` → FAIL (módulo no existe).

- [ ] **Step 2: Implementar `lib/at-a-glance.ts`**

```ts
import type { Evento } from "./eventos";

export type AtAGlance = {
  hoy: number;
  finde: number;
  semana: number;
  fechaLabel: string;
};

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfDay(d: Date): Date {
  return new Date(Math.floor(d.getTime() / 86400000) * 86400000 - d.getTimezoneOffset() * 60000);
}

function parseDate(dateStr: string): Date | null {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

export function esHoy(dateStr: string, now: Date): boolean {
  const d = parseDate(dateStr);
  return !!d && toLocalDateStr(d) === toLocalDateStr(now);
}

export function esEstaSemana(dateStr: string, now: Date): boolean {
  const d = parseDate(dateStr);
  if (!d) return false;
  const hoy = startOfDay(now);
  const limite = new Date(hoy);
  limite.setDate(limite.getDate() + 7);
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return t >= hoy.getTime() && t < limite.getTime();
}

export function esEsteFinde(dateStr: string, now: Date): boolean {
  if (!esEstaSemana(dateStr, now)) return false;
  const d = parseDate(dateStr)!;
  const wd = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getDay();
  return wd === 0 || wd === 6;
}

export function formatFechaViva(date: Date): string {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(date);
}

export function getAtAGlance(eventos: Evento[], now = new Date()): AtAGlance {
  return {
    hoy: eventos.filter((e) => esHoy(e.date, now)).length,
    finde: eventos.filter((e) => esEsteFinde(e.date, now)).length,
    semana: eventos.filter((e) => esEstaSemana(e.date, now)).length,
    fechaLabel: formatFechaViva(now),
  };
}
```

Run `npx jest __tests__/at-a-glance.test.ts` → PASS.

- [ ] **Step 3: El test e2e de la franja (rojo primero)**

Añadir a `e2e/homepage.spec.ts` (describe `"Homepage"`):

```ts
  test("shows the at-a-glance strip with live date and counters", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.locator(".e2e-ataglance")).toBeVisible({ timeout: 30_000 });
  });
```

Run `npx playwright test e2e/homepage.spec.ts` → FAIL (el selector no existe aún).

- [ ] **Step 4: Crear `app/components/AtAGlanceStrip.tsx`**

```tsx
import Link from "next/link";
import type { Evento } from "@/lib/eventos";
import { getAtAGlance } from "@/lib/at-a-glance";
import { CATEGORY_COLORS, normalizeCategory } from "@/lib/categories";

const CHIPS: { label: string; href: string; cat: string }[] = [
  { label: "Música", href: "/conciertos", cat: "Música" },
  { label: "Cine", href: "/movies", cat: "Cine" },
  { label: "Niños", href: "/kids", cat: "Infantil" },
  { label: "Cultura", href: "/culture", cat: "Teatro" },
  { label: "Deporte", href: "/deporte", cat: "Deporte" },
  { label: "Turismo", href: "/turismo", cat: "Visitas" },
  { label: "Gastronomía", href: "/gastronomia", cat: "Gastronomía" },
];

export default function AtAGlanceStrip({
  eventos,
  partidos,
}: {
  eventos: Evento[];
  partidos: number;
}) {
  const { hoy, finde, semana, fechaLabel } = getAtAGlance(eventos);

  return (
    <section aria-label="De un vistazo" className="px-5 sm:px-6 max-w-7xl mx-auto mt-6 md:mt-8">
      <div className="e2e-ataglance rounded-2xl border border-border bg-bg-muted overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-fg-subtle">
            {fechaLabel}
          </span>
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-fg">
            <span className="size-1.5 rounded-full bg-lime" aria-hidden="true" />
            {hoy} planes hoy
          </span>
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-fg">
            <span className="size-1.5 rounded-full bg-violet" aria-hidden="true" />
            {finde} este finde
          </span>
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-fg">
            <span className="size-1.5 rounded-full bg-teal" aria-hidden="true" />
            {partidos} partido{partidos === 1 ? "" : "s"} de los nuestros
          </span>
        </div>
        <div className="flex gap-2 flex-wrap px-5 pb-4">
          {CHIPS.map((c) => {
            const cat = normalizeCategory(c.cat);
            const color = CATEGORY_COLORS[cat] || "#7C8794";
            return (
              <Link
                key={c.href}
                href={c.href}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition-transform duration-300 hover:-translate-y-0.5"
                style={{ backgroundColor: color, color: "#0B0E14" }}
              >
                {c.label}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
```

Nota: `bg-lime`, `bg-violet`, `bg-teal` son utilities generadas por las filas `@theme inline` añadidas en Task 1.

- [ ] **Step 5: Insertar en `app/page.tsx`**

1. Importar: `import AtAGlanceStrip from "./components/AtAGlanceStrip";` y `import { getProximosPartidos } from "@/lib/partidos";`.
2. Añadir al final de la página (en el JSX raíz, **tras** el `Suspense` del hero y **antes** del `Suspense` de `SectionsHub`):

```tsx
      <Suspense fallback={null}>
        <AtAGlanceWithData />
      </Suspense>
```

3. Añadir debajo de `SocialProofWithData()`:

```tsx
async function AtAGlanceWithData() {
  const [eventos, partidos] = await Promise.all([
    getCachedEventos(),
    getProximosPartidos(1),
  ]);
  return <AtAGlanceStrip eventos={eventos} partidos={partidos.length} />;
}
```

- [ ] **Step 6: Verificar y commitear**

Run `npx jest __tests__/at-a-glance.test.ts` → PASS.
Run `npx playwright test e2e/homepage.spec.ts` → verdes (incl. `.e2e-ataglance`).
Run `npx eslint lib/at-a-glance.ts app/components/AtAGlanceStrip.tsx __tests__/at-a-glance.test.ts app/page.tsx e2e/homepage.spec.ts` → 0 hallazgos.

```bash
git add lib/at-a-glance.ts __tests__/at-a-glance.test.ts app/components/AtAGlanceStrip.tsx app/page.tsx e2e/homepage.spec.ts
git commit -m "feat(home): at-a-glance strip with live date and counters"
```

---

### Task 5: Hero Fever + "Plan destacado" (desktop)

**Files:**
- Modify: `app/components/HeroSection.tsx`
- Test: `e2e/homepage.spec.ts`

**Interfaces:**
- Consumes: `getPopularEvents` de `@/lib/popularity`, `formatDate`/`shortTime` de `@/lib/utils`, `eventSlug` de `@/lib/slug`, `CATEGORY_COLORS`/`normalizeCategory` de `@/lib/categories`. Props sin cambio (`eventos: Evento[]`).
- Produces: hero con `aria-label="Plan destacado"` en la tarjeta destacada (desktop).

- [ ] **Step 1: El test e2e del hero (rojo primero)**

Añadir al describe `"Homepage"`:

```ts
  test("hero shows the search and a featured plan card on desktop", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("search")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('a[aria-label="Plan destacado"]').first()).toBeVisible();
  });
```

Run → FAIL (no existe `aria-label="Plan destacado"`). Nota: `getByRole("search")` matchea tanto el form del header como el `HeroSearch`; si el matcher da ambigüedad, usar `page.locator('input[aria-label="Buscar eventos"]').first()` en su lugar (dejar el form del header como está).

- [ ] **Step 2: Reescribir `HeroSection.tsx`**

Reemplazar el componente entero por:

```tsx
"use client";

import { useMemo } from "react";
import Link from "next/link";
import { InViewWrapper } from "@/lib/shared";
import HeroSearch from "./HeroSearch";
import { getPopularEvents } from "@/lib/popularity";
import { formatDate, shortTime } from "@/lib/utils";
import { eventSlug } from "@/lib/slug";
import { CATEGORY_COLORS, normalizeCategory } from "@/lib/categories";

type Evento = {
  id: string;
  title: string;
  date: string;
  image?: string;
  location?: string;
  link?: string;
  category?: string;
  source?: string;
  time?: string;
};

export default function HeroSection({ eventos }: { eventos: Evento[] }) {
  const totalThisWeek = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + 7);
    return eventos.filter((ev) => {
      const d = new Date(ev.date);
      return !isNaN(d.getTime()) && d >= today && d < horizon;
    }).length;
  }, [eventos]);

  const destacado = useMemo(() => getPopularEvents(eventos, 1)[0] ?? null, [eventos]);

  return (
    <section className="relative px-5 sm:px-6 pt-28 pb-10 md:pt-36 md:pb-14 overflow-hidden">
      <div className="aurora" aria-hidden="true" />
      <div className="relative max-w-5xl mx-auto">
        <InViewWrapper eager>
          <p className="flex items-center gap-3 mb-6">
            <span className="inline-flex items-center font-mono text-[11px] font-bold uppercase tracking-[0.18em] px-3 py-1 rounded-full bg-lime text-[#0B0E14]">
              {totalThisWeek > 0 ? `${totalThisWeek} planes esta semana` : "Agenda de la ciudad"}
            </span>
            <span aria-hidden="true" className="h-px w-10 bg-border" />
            <span className="font-mono text-[11px] text-fg-subtle">Vitoria-Gasteiz</span>
          </p>
        </InViewWrapper>

        <InViewWrapper eager>
          <h1 className="font-display text-[clamp(2.5rem,7vw,4.75rem)] font-black uppercase tracking-[-0.04em] leading-[0.98] text-fg mb-5 max-w-3xl">
            La agenda de Vitoria-Gasteiz
          </h1>

          <p className="text-base md:text-lg text-fg-muted max-w-md leading-relaxed mb-8">
            {totalThisWeek > 0
              ? `Conciertos, teatro, cine, deporte y planes familiares: ${totalThisWeek} propuestas confirmadas.`
              : "Conciertos, exposiciones, cine, deporte y planes familiares, recogidos en un solo sitio."}
          </p>

          <div className="mb-10 max-w-xl">
            <HeroSearch />
          </div>
        </InViewWrapper>

        {destacado && (
          <InViewWrapper eager delay={0.1} className="hidden lg:block">
            <Link
              href={`/evento/${eventSlug(destacado)}`}
              aria-label="Plan destacado"
              className="group double-bezel rounded-2xl p-4 flex items-center gap-4 card-hover"
            >
              <img
                src={destacado.image}
                alt=""
                className="h-20 w-20 rounded-xl object-cover shrink-0"
              />
              <div className="min-w-0">
                <span
                  className="inline-flex items-center font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: CATEGORY_COLORS[normalizeCategory(destacado.category)] || "#7C8794",
                    color: "#0B0E14",
                  }}
                >
                  {normalizeCategory(destacado.category)}
                </span>
                <h3 className="font-display text-lg font-black text-fg leading-tight mt-1.5 line-clamp-2">
                  {destacado.title}
                </h3>
                <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-fg-subtle mt-1 truncate">
                  {(() => {
                    const { day, month } = formatDate(destacado.date);
                    const time = shortTime(destacado.time);
                    return `${day} ${month}${time ? ` · ${time}` : ""}${destacado.location ? ` · ${destacado.location}` : ""}`;
                  })()}
                </p>
              </div>
              <span aria-hidden="true" className="ml-auto text-2xl text-fg-subtle group-hover:text-accent transition-colors shrink-0">→</span>
            </Link>
          </InViewWrapper>
        )}
      </div>
    </section>
  );
}
```

Nota sobre `<img>`: el proyecto ya usa la regla `@next/next/no-img-element` con `eslint-disable` cuando es necesario. Aquí `destacado.image` es una URL de un evento (dominio arbitrario) y el `next/image` `remotePatterns` puede no cubrirla; si el lint de este archivo arroja el warning, lo más simple es usar `eslint-disable-next-line @next/next/no-img-element` **solo** en esa línea (patrón ya usado en `PartidosSection.tsx:35`). La clase `double-bezel` y `card-hover` ya existen en `globals.css`.

- [ ] **Step 3: Verificar y commitear**

Run `npx playwright test e2e/homepage.spec.ts` → verdes.
Run `npx eslint app/components/HeroSection.tsx e2e/homepage.spec.ts` → 0 hallazgos (o solo el disable apuntado).

```bash
git add app/components/HeroSection.tsx e2e/homepage.spec.ts
git commit -m "feat(home): fever hero with featured plan"
```

---

### Task 6: Hub de categorías Fever

**Files:**
- Modify: `app/components/SectionsHub.tsx`
- Modify: `app/components/SectionsHub.tsx` header (usa `SectionHead`)
- Test: `e2e/homepage.spec.ts`

**Interfaces:**
- Consumes: tokens Task 1, `CATEGORY_COLORS` Task 2, `SectionHead` Task 3. La interfaz exportada (`SectionsHub()` server, sin props) no cambia.

- [ ] **Step 1: El test e2e del hub (rojo primero)**

Añadir al describe `"Homepage"`:

```ts
  test("hub links cover the main categories", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    for (const href of ["/conciertos", "/movies", "/kids", "/culture", "/deporte", "/turismo", "/gastronomia"]) {
      await expect(page.locator(`a[href="${href}"]`).first()).toBeVisible({ timeout: 30_000 });
    }
  });
```

Run → FAIL hoy (los enlaces `/conciertos`… existen pero el de `/gastronomia`/`/turismo` puede no estar en viewport; `toBeVisible` sin scroll fallará para los de abajo).

- [ ] **Step 2: Header del hub con `SectionHead`**

En `app/components/SectionsHub.tsx`, sustituir el bloque `InViewWrapper` del título "Explora Vitoria-Gasteiz" (líneas 185-192) por:

```tsx
      <SectionHead tag="Categorías" title="Explora Vitoria-Gasteiz" color="var(--teal)" />
```

Añadir `import SectionHead from "./SectionHead";`.

- [ ] **Step 3: Repintar las tarjetas Fever**

En el `map` de `categories` (dentro del `<Link>`), sustituir:
1. La clase del `<span>` del icono de la rama sin imagen (línea 244): `"bg-surface border border-border shadow-sm text-fg ...` → `"grid size-11 place-items-center rounded-xl text-[#0B0E14] shadow-lg transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-y-0.5"` con `style={{ backgroundColor: CATEGORY_COLORS[label] || "var(--accent)", color: "#0B0E14" }}` (importar `CATEGORY_COLORS` de `@/lib/categories`; ya importa `normalizeCategory`).
2. En la rama con imagen (icono blanco sobre vidrio), no tocar (ya es coherente con Fever).
3. Mantener el count con `tabular-nums` y la flecha `→`.

No cambiar el `href`, el `tint`/`wash` (siguen siendo var-driven) ni la retícula `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`.

- [ ] **Step 4: Verificar y commitear**

Run `npx playwright test e2e/homepage.spec.ts` → verdes (el nuevo hub test usa `toBeVisible` — paginar no es necesario porque `page.goto("/")` carga la home completa; si algún link queda por debajo del fold y Playwright requiere scroll, usar `first()` con `scrollIntoViewIfNeeded` implícito en `toBeVisible(pattern)`).

Run `npx eslint app/components/SectionsHub.tsx e2e/homepage.spec.ts` → 0 hallazgos.

```bash
git add app/components/SectionsHub.tsx e2e/homepage.spec.ts
git commit -m "feat(home): fever categories hub"
```

---

### Task 7: Cabeceras unificadas en carruseles, Top 10, próximos eventos y La Blanca

**Files:**
- Modify: `app/components/CategoryCarousel.tsx` (props `tag`, `tagColor`)
- Modify: `app/components/TopEventsSection.tsx` (header)
- Modify: `app/components/HomeEventsClient.tsx` (header)
- Modify: `app/components/FiestasBlancaSection.tsx` (header)
- Modify: `app/page.tsx` (pasar `tag` a los `CategoryCarousel`)
- Test: `e2e/homepage.spec.ts`

**Interfaces:**
- `CategoryCarousel` gana props opcionales `tag?: string; tagColor?: string;` (no rompe usos existentes). `TopEventsSection`, `HomeEventsClient`, `FiestasBlancaSection` siguen sin cambios de props.

- [ ] **Step 1: El test e2e de cabeceras de sección (rojo primero si falta algún heading)**

Añadir al describe `"Homepage"`:

```ts
  test("shows carousels, top10 and events headers", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /Top 10 en Vitoria-Gasteiz/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /Próximos eventos/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Conciertos/i }).first()).toBeVisible();
  });
```

Run → puede fallar parcialmente hasta Step 2; ese es el rojo esperado para los headers nuevos.

- [ ] **Step 2: `CategoryCarousel` con `SectionHead`**

1. Añadir al contrato de props y al JSX de la cabecera (sustituir el `InViewWrapper` con `flex items-end justify-between` de las líneas 49-89):

```tsx
  tag,
  tagColor,
}: {
  title: string;
  subtitle?: string;
  events: EventCardEvento[];
  href?: string;
  categoryColors?: Record<string, string>;
  variant?: "rail" | "grid";
  tag?: string;
  tagColor?: string;
}) {
```

```tsx
        <InViewWrapper>
          <div className="flex items-end justify-between gap-4 mb-6">
            <SectionHead
              tag={tag}
              title={title}
              subtitle={subtitle}
              href={href}
              color={tagColor}
            />
            {variant === "rail" && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => scrollBy(-1)}
                  aria-label="Anterior"
                  className="grid size-9 place-items-center rounded-full border border-border bg-surface text-fg-muted hover:text-accent hover:border-accent/40 transition-all duration-300 active:scale-[0.92] cursor-pointer disabled:opacity-40"
                >
                  <ArrowIcon className="w-4 h-4 rotate-180" />
                </button>
                <button
                  onClick={() => scrollBy(1)}
                  aria-label="Siguiente"
                  className="grid size-9 place-items-center rounded-full border border-border bg-surface text-fg-muted hover:text-accent hover:border-accent/40 transition-all duration-300 active:scale-[0.92] cursor-pointer"
                >
                  <ArrowIcon className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </InViewWrapper>
```

Nota: `SectionHead` ya incluye el "Ver todo" cuando `href`. En `variant="grid"` no había flechas: se conserva el botón de "Ver todo" móvil existente (líneas 105-115).

2. Añadir `import SectionHead from "./SectionHead";`.

3. En `app/page.tsx`, pasar `tag` y `tagColor` a los tres carruseles:

```tsx
      <CategoryCarousel title="Conciertos" ... tag="Música" tagColor="var(--hot)" />
      <CategoryCarousel title="Cultura" ... variant="grid" tag="Cultura" tagColor="var(--violet)" />
      <CategoryCarousel title="Planes familiares" ... variant="grid" tag="Niños" tagColor="var(--teal)" />
```

- [ ] **Step 3: `TopEventsSection` con `SectionHead`**

Sustituir el bloque del header (líneas 38-68: el kicker de estrella + título + subtítulo + botones) por:

```tsx
          <div className="flex items-end justify-between gap-4 mb-6">
            <SectionHead
              tag="Top 10"
              title="Top 10 en Vitoria-Gasteiz"
              subtitle="Los planes que más suenan esta semana"
              color="var(--amber)"
            />
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => scrollBy(-1)}
                aria-label="Anterior"
                className="grid size-9 place-items-center rounded-full border border-border bg-surface text-fg-muted hover:text-accent hover:border-accent/40 transition-all duration-300 active:scale-[0.92] cursor-pointer"
              >
                <ArrowIcon className="w-4 h-4 rotate-180" />
              </button>
              <button
                onClick={() => scrollBy(1)}
                aria-label="Siguiente"
                className="grid size-9 place-items-center rounded-full border border-border bg-surface text-fg-muted hover:text-accent hover:border-accent/40 transition-all duration-300 active:scale-[0.92] cursor-pointer"
              >
                <ArrowIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
```

Añadir `import SectionHead from "./SectionHead";`. El rail de tarjetas numeradas no se toca.

- [ ] **Step 4: `HomeEventsClient` con `SectionHead`**

Sustituir el `InViewWrapper` de cabecera (líneas 23-32) por:

```tsx
        <InViewWrapper>
          <SectionHead
            tag="Agenda"
            title="Próximos eventos"
            subtitle="Lo que viene en Vitoria-Gasteiz"
            href="/culture"
            linkLabel="Ver todos los eventos"
            color="var(--violet)"
          />
        </InViewWrapper>
```

Añadir el import. El botón "Ver todos los eventos" del pie (líneas 67-81) se puede eliminar (queda duplicado en la cabecera), o conservarlo si prefieres; la decisión: **eliminarlo** para ritmo limpio (el `SectionHead` ya tiene el link). Si lo eliminas, quita también el `Link` del import si queda sin usar.

- [ ] **Step 5: `FiestasBlancaSection` con `SectionHead`**

Sustituir el bloque de cabecera (líneas 54-65) por:

```tsx
            <SectionHead
              tag="Fiestas"
              title={`La Blanca ${year}`}
              subtitle={range ? `${range} · Programación completa` : "Programación completa"}
              href="/fiestas-blanca"
              linkLabel="Ver programa completo"
              color="var(--hot)"
            />
```

Añadir el import. Se puede quitar el `<a href="/fiestas-blanca">` del pie (líneas 79-98) por duplicado (decisión: eliminar, igual que en HomeEventsClient). Es un componente estacional que no se renderiza fuera de temporada.

- [ ] **Step 6: Verificar y commitear**

Run `npx playwright test e2e/homepage.spec.ts` → verdes.
Run `npx eslint app/components/CategoryCarousel.tsx app/components/TopEventsSection.tsx app/components/HomeEventsClient.tsx app/components/FiestasBlancaSection.tsx app/page.tsx e2e/homepage.spec.ts` → 0 hallazgos.

```bash
git add app/components/CategoryCarousel.tsx app/components/TopEventsSection.tsx app/components/HomeEventsClient.tsx app/components/FiestasBlancaSection.tsx app/page.tsx e2e/homepage.spec.ts
git commit -m "feat(home): unify section headers on carousels, top10, events"
```

---

### Task 8: PartidosSection con `SectionHead` y tarjetas Fever

**Files:**
- Modify: `app/components/PartidosSection.tsx`
- Test: `e2e/homepage.spec.ts`

**Interfaces:**
- Consumes: `SectionHead`, tokens, `Partido` de `@/lib/sources/clubCms`. No cambia props (server, sin args).

- [ ] **Step 1: El test e2e de partidos ya existe** (heading `Nuestros equipos en acción` + `a[href="/deporte"]`). Verificar que sigue verde tras el cambio de cabecera.

Dato: los asserts actuales de `homepage.spec.ts` (líneas 28-35) ya cubren esto. Solo añadir un assert del tag pill de deporte:

```ts
  test("partidos section uses the sports lime tag", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const tag = page.getByText("Deporte", { exact: true }).first();
    await expect(tag).toBeVisible({ timeout: 30_000 });
  });
```

(El tag "Deporte" puede colisionar con el chip del hub o de la franja; `first()` y `exact: true` lo acotan si es preciso.)

- [ ] **Step 2: Cabecera con `SectionHead`**

Sustituir el `div` de cabecera de `PartidosSection` (líneas 75-84) por:

```tsx
      <SectionHead
        tag="Deporte"
        title="Nuestros equipos en acción"
        subtitle="Baskonia, Alavés y Araski, sus próximas citas."
        href="/deporte"
        linkLabel="Ver agenda deportiva"
        color="var(--lime)"
      />
```

Añadir `import SectionHead from "./SectionHead";`.

- [ ] **Step 3: Tarjetas con lenguaje Fever**

En `PartidoCard` (dentro de `app/components/PartidosSection.tsx`):
- Sustituir la clase `"double-bezel rounded-2xl p-5 flex flex-col gap-3 card-hover h-full"` por `"rounded-2xl border border-border bg-surface p-5 flex flex-col gap-3 card-hover h-full"`.
- El texto del club (`text-sec-green`) → `text-lime` (`className="text-xs font-bold uppercase tracking-wide text-lime"`).
- El link "Entradas →" (`text-sec-green hover:underline`) → `text-lime hover:underline`. El resto (escudos, `vs`, estadio, hora) se mantiene.

- [ ] **Step 4: Verificar y commitear**

Run `npx playwright test e2e/homepage.spec.ts` → verdes.
Run `npx eslint app/components/PartidosSection.tsx e2e/homepage.spec.ts` → 0 hallazgos.

```bash
git add app/components/PartidosSection.tsx e2e/homepage.spec.ts
git commit -m "feat(home): fever partidos section header and cards"
```

---

### Task 9: Cifras "Gasteiz Click en cifras" con métrica de deporte

**Files:**
- Modify: `app/components/SocialProof.tsx`
- Modify: `app/page.tsx` (`SocialProofWithData` pasa datos reales)
- Test: `e2e/homepage.spec.ts`

**Interfaces:**
- Consumes: `FreshnessBadge` de `./FreshnessBadge` (ya existe), datos de `getCachedEventos`.
- `SocialProof` gana props: `{ eventCount: number; thisWeekCount: number; since: number }` (se mantiene el "return null" si `eventCount <= 0`).

- [ ] **Step 1: El test e2e de cifras (rojo primero)**

Añadir al describe `"Homepage"`:

```ts
  test("shows Gasteiz Click en cifras with the sports metric", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /Gasteiz Click en cifras/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/3 clubes · 2 deportes · 1 ciudad/i)).toBeVisible();
  });
```

Run → FAIL.

- [ ] **Step 2: Reescribir `SocialProof.tsx`**

Reemplazar el componente (manteniendo `Stat`, `InViewWrapper` e import) por:

```tsx
import { InViewWrapper } from "@/lib/shared";
import FreshnessBadge from "./FreshnessBadge";

function Stat({ value, label, detail }: { value: string; label: string; detail: string }) {
  return (
    <div className="border-t border-border pt-4">
      <dt className="font-display text-3xl md:text-4xl font-black text-fg tracking-[-0.02em] tabular-nums">
        {value}
      </dt>
      <dd className="mt-1 text-sm font-bold text-fg">{label}</dd>
      <dd className="mt-1 text-xs text-fg-muted leading-relaxed">{detail}</dd>
    </div>
  );
}

export default function SocialProof({
  eventCount,
  thisWeekCount,
  since,
}: {
  eventCount: number;
  thisWeekCount: number;
  since: number;
}) {
  if (eventCount <= 0) return null;

  return (
    <section className="px-5 sm:px-6 py-12 md:py-16">
      <div className="max-w-6xl mx-auto border-t border-border pt-10 md:pt-14">
        <InViewWrapper>
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
            <div className="max-w-md">
              <span className="inline-flex items-center font-mono text-[11px] font-bold uppercase tracking-[0.18em] px-3 py-1 rounded-full bg-violet text-[#0B0E14] mb-6">
                Cifras
              </span>
              <h2 className="font-display text-3xl md:text-4xl font-black uppercase tracking-[-0.03em] text-fg leading-tight">
                Gasteiz Click en cifras
              </h2>
              <div className="mt-4">
                <FreshnessBadge since={since} />
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-10">
              <Stat
                value={`${thisWeekCount}+`}
                label="planes esta semana"
                detail="Propuestas confirmadas en los próximos 7 días."
              />
              <Stat
                value="15+"
                label="fuentes de datos"
                detail="Rula, Jimmy Jazz, VAM, ayuntamiento, Euskadi y más."
              />
              <Stat
                value="Diaria"
                label="actualización"
                detail="La agenda se refresca cada pocos minutos."
              />
              <Stat
                value="3 clubes · 2 deportes · 1 ciudad"
                label="deporte pro"
                detail="Baskonia, Alavés y Araski en una sola agenda."
              />
            </dl>
          </div>
        </InViewWrapper>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Pasar los datos reales en `app/page.tsx`**

Sustituir `SocialProofWithData`:

```tsx
async function SocialProofWithData() {
  const eventos = await getCachedEventos();
  const since = Date.now();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 7);
  const thisWeek = eventos.filter((e) => {
    const d = new Date(e.date);
    return !isNaN(d.getTime()) && d >= today && d < horizon;
  }).length;
  return (
    <SocialProof eventCount={eventos.length} thisWeekCount={thisWeek} since={since} />
  );
}
```

(El `since` es el instante de render del servidor; el `FreshnessBadge` hace el recuento en cliente y muestra "Actualizado hace Xs/min". `revalidate 300` se mantiene.)

- [ ] **Step 4: Verificar y commitear**

Run `npx playwright test e2e/homepage.spec.ts` → verdes.
Run `npx eslint app/components/SocialProof.tsx app/page.tsx e2e/homepage.spec.ts` → 0 hallazgos.

```bash
git add app/components/SocialProof.tsx app/page.tsx e2e/homepage.spec.ts
git commit -m "feat(home): Gasteiz Click en cifras with freshness and sports"
```

---

### Task 10: Newsletter en gradiente y verificación final

**Files:**
- Modify: `app/components/NewsLetter.tsx`
- Test: `e2e/homepage.spec.ts`
- Final: `npx jest` + `npx playwright test` + `nx eslint` (archivos propios)

**Interfaces:**
- Consumes: tokens Task 1. Sin cambios de lógica de suscripción (`/api/newsletter/subscribe` intacto).

- [ ] **Step 1: El test e2e del newsletter (rojo primero)**

Añadir al describe `"Homepage"`:

```ts
  test("newsletter panel is visible with subscribe form", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/No te pierdas/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Suscribir" })).toBeVisible();
  });
```

Run → puede fallar hasta Step 2 el rol button (ya existe "Suscribir", así que probablemente pase ya): si pasa antes del cambio, es aceptable; el rojo accionable es el bloque de gradiente en Step 2.

- [ ] **Step 2: Panel dos tonos con gradiente**

En `app/components/NewsLetter.tsx`, sustituir la clase del contenedor `rounded-[1.5rem] bg-accent p-8 md:p-12` por:

```tsx
        className="relative overflow-hidden rounded-[1.5rem] p-8 md:p-12"
        style={{
          background:
            "linear-gradient(135deg, var(--violet) 0%, var(--hot) 55%, var(--amber) 120%)",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(16px)",
          transition: "all 0.6s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
```

(Es decir, mover la gradiente al `style.background` y quitar las clases `bg-accent`; el pseudo-wash interno con `radial-gradient(...rgba(255,255,255,0.14))` se conserva. El resto del componente —inputs, honeypot, estados, `handleSubmit`— intactos.)

- [ ] **Step 3: Verificación completa (gate final)**

Run `npx jest` → todo verde salvo la falla pre-existente documentada `gastronomia.test.ts` (Expected >=3 zonas, Received 2).
Run `npx playwright test e2e/homepage.spec.ts` → todas las suites del archivo verdes (5 originales + las nuevas; detalle de evento incluido).
Run `npx eslint app/components/NewsLetter.tsx e2e/homepage.spec.ts` → 0 hallazgos.
Smoke manual de rutas interiores (la home pintada con tokens nuevos no debe romperlas): abrir `/culture`, `/conciertos`, `/deporte` y comprobar que renderizan (los tokens nuevos las re-themen sin romper la lógica).

Si algo falla fuera del alcance (p. ej. e2e de otra página), anotarlo, no arreglarlo aquí.

```bash
git add app/components/NewsLetter.tsx e2e/homepage.spec.ts
git commit -m "feat(home): gradient newsletter panel"
```

---

## Self-Review

**Cobertura del spec (2.1-2.4):**
- 2.1 tokens oscuros ✓ T1; paleta viva `--hot/--violet/--teal/--amber/--lime` ✓ T1+T2; categorías reasignadas ✓ T2; light "bright" ✓ T1 (toggle auto/light/dark intacto); Archivo display+body + JetBrains mono ✓ T1; kickers itálicos → pills ✓ T3/T4/T7/T8/T9; tarjetas redondas + wash + hover glow ✓ tokens T1 + EventCard T2; chips fill sólido + texto oscuro ✓ T2; auroras sustituyen hero-grid ✓ T1 (+uso en hero T5); copy Fever ✓ en cada cabecera; barra de un vistazo ✓ T4; repintado global EventCard ✓ T2 (interiores heredan coherencia; deep-restyle interior queda fuera ✓ según spec).
- 2.2 estructura 1-12: Hero+destacado T5; Franja T4; Hub T6; Partidos T8; Hoy T3; 7 días T3; Moods T3; Top10 T7; Carruseles T7; Cifras T9; Próximos T7; Newsletter T10. ✓
- 2.3 cambios 1-6 ✓ (Hero/Franja/Hub/SectionHead/Cifras/Newsletter) en T5/T4/T6/T3+T7/T9/T10.
- 2.4 conservación: EventCard ciclo intacto ✓; e2e existente sin tocar sus asserts ✓ (cada tarea solo añade); `revalidate 300` ✓; toggle ✓ (T1 test).
- Spec §Testing: jest unidades (at-a-glance, categories) ✓; e2e home (franja T4, partidos T1/T8, cifras T9, tema T1, cabeceras T3/T7).

**Escaneo de placeholders:** todas las tareas incluyen código literal completo o diffs mecánicos con valores exactos; la única regla genérica ("transponer 6 bloques de acento") se define con el ejemplo completo de `invierno` y pasos numerados para el resto (no hay "como en el paso anterior").

**Consistencia de tipos:** `SectionHead` (tag/title/subtitle/href/linkLabel/color) se usa igual en T3/T6/T7/T8; `AtAGlanceStrip` (`{eventos; partidos}`) definido en T4 y consumido en T4/T5; `SocialProof` props (`eventCount/thisWeekCount/since`) definidos y usados en T9; `CategoryCarousel` `tag/tagColor` definidos y usados en T7. Los nombres de clase de anclaje e2e (`e2e-ataglance`, `e2e-cat-pill`) se crean en el mismo task que los usa.

## Execution Handoff

Plan guardado en `docs/superpowers/plans/2026-09-23-landing-fever.md`. Dos opciones de ejecución:

1. **Subagent-Driven (recomendado)** — agente fresco por tarea + revisión entre tareas (superpowers:subagent-driven-development).
2. **Inline** — ejecutar en esta sesión con superpowers:executing-plans (lotes con checkpoints de revisión).