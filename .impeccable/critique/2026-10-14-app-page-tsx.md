# Auditoría de diseño — GasteizClick (web ↔ nativa)

> Reporte actualizado en Build mode 2026-10-14 con evidencia real. Detector `impeccable`
> re-corrido sobre `app/` (limpio) + live-browser evidence capturada por:
> - `.impeccable/dev-evidence.json` (8 viewport×route snapshots).
> Hallazgos concretos del live detect:
>   - `home` @390×844 y @1440×900: **overflow horizontal en 390**; 7
>     anti-patterns `undersized-ui-text` (10px functional text en el BottomNav).
>   - `/culture`: 1723 imágenes en 390×844 (carousels sin lazy?), 0 issues detect.
>   - `/conciertos`: 9–11 `undersized-ui-text` anti-patterns (pasacalles text 10px).
>   - `/hoy`: 18–22 `undersized-ui-text` anti-patterns.
> Corregido en el mismo commit: BottomNav labels bumped a 11px (3 ediciones +
> badge a 10px). Los Tailwind `gap-*` etc. no cambian tomando los 11px.
>
> `__tests__/touch-targets.test.ts` continúa verde.

- **Target principal:** `app/page.tsx` (representativa de la web)
- **Compare target:** `C:\Users\javie\React-native\V2\GasteizClick`
- **Ejecutado:** 2026-10-14, build mode.
- **Method:** single-context synthesis degraded (Assessment A preserved from
  `critique` drafted earlier, agent `general`; Assessment B detector re-run in
  build mode via `.impeccable/cmd detect --json app`).

## 1. Detector — `app/` (determinista)

`impeccable.cmd detect --json app` → `[]`

Es decir: sobre la web productiva (sin contar `__tests__/fixtures`, donde todos
los 278 hallazgos del scan amplio eran imágenes placeholders de fixtures), el
detector no encuentra ningún patrón antipattern. La heurística de estática de
la web no detecta problemas: sin overflow obvio, sin cajas «Hello World»,
clasename inconsistentes, iconos overly reduced.

Esto es **buena señal para tareas "obvio"**, PERO no cubre:
- contraste real vs fondo (se evalúa en browser).
- targets touch-size reales en el flujo (tampoco el toolbar sin interacción).
- exhaustividad de feedback (empty/skeleton/error beyond the four initial routes).

**Falsos positivos del scan amplio (`__tests__/fixtures`):** todos los `broken-image`,
`undersized-ui-text`, etc. del scan de 278 provienen de **fixtures de tests**
(HTML de prueba pegado en `__tests__/fixtures`), no del producto. No es prudente
intentar arreglarlos: el detector no distingue una imagen real rota de un
placeholder de fixture. Para re-evaluar escanear sólo `app/`.

## 2. Veredicto de especificidad (Assessment A)

«El sistema, no. El contenido, sí — y esa es exactamente la frontera.»

Lo que **es** específico de Vitoria-Gasteiz (irreemplazable por un starter):
- `getPopularEvents` con **peso por grupo**, y **`Infantil = 26 por encima de
  `Teatro` (25 en `lib/popularity.ts`)** — la decisión de producto más específica
  del repo, fijada como número.
- «Nuestros equipos en acción» con Baskonia, Alavés y Araski — mismos domingos.
- «Qué ver en Gasteiz», «Pintxos y sitios», «Agenda deportiva», «Ver agenda»,
  «Hoy 14 · 74 eventos».
- H1 «LA AGENDA DE VITORIA-GASTEIZ» (40px / 900 / uppercase, Archivo).

Lo que el sistema hizo dentro de una tailwind por defecto; irremplazable per se:
- Categorias con `bg/accent` por chips, ni singularidad visual.
- Hero limitado a `color-brand-red` + `bg`; sin elemento distintivo de Vitoria.
- motion/animación minimalista (correcto por excelencia).

Conclusión: la identidad vive en los **datos y los textos**, no en el
skin. Las 3 tareas propuestas atacan el skin.

## 3. Divergencias web ↔ nativa (Assessment A, tabla)

<|end|> Eje                       | Web (`app/`)                                     | Nativa (`React-native/...`)                 | Divergencia |
|---------------------------|--------------------------------------------------|---------------------------------------------|-------------|
| Paleta                    | `globals.css` (bg #0B0E14, accent #BC0202, 15 grupos de color) | `appTheme.tsx` copia literal los mismos valores | ✅ nula |
| Tipografía                | Archivo (variable) + JetBrains Mono para tabular via `next/font` | `fonts = { display/body/mono: undefined }` → sistema sans | ❌ visible: el H1 aparece distinto |
| Escala tipográfica        | Tailwind `text-*` + variables personalizadas | `typography` reescribita en escala 32/24/20/17/15/14/13/11 (uniforme) | ❌ | 
| Tarjetas / radios         | `rounded-2xl` + estilo complejo (hover, overlays) | `radius.` definido, sin overlays de hover real | ⚠ parcial |
| Categorías                | 15 taxonómicas (`lib/categories.ts`) + 4 cubos de vista (`CULTURA_CATEGORIAS`) | 1 `ListCategorias` agrega todas sin recorte — no hay vista individual por categoría | ❌ los 4 cubos de la portada no tienen equivalente en app |
| Navegación                | Header sticky + BottomNav móvil + menú móvil con «instalar/App Android» | `navigator` con stacks + `PestanaBar` header, sin bottom tab bar global | ⚠ distinto modelo |
| Navegación de screenshots | plusieurs capturas en el repo **son de la web**, no de la app — la app no tiene ni una captura propia | no existen capturas | ❌ sin baseline visual |
| Motion / reducción        | Tailwind transition classes con `motion-safe` | Sin `useReducedMotion`; anima con las defaults | ⚠ |
| Estados vacíos/carga      | i.e. `/offline`, error boundary por ruta, skeletons en algunas | `NoResults`, `ErrorState` — existen pero no siempre aplican | ⚠ inconsistente |
| Push/installed detection  | `useInstallPrompt`/`useInstalled` re-usado en 3 sitios | No aplica (native no tiene PWA prompt) | n/a |
| Persistencia              | `localStorage` (`favorites`, `install-dismissed`) | `AsyncStorage` | ✅ equivalente, no equivalencia visual |

## 4. Banderas rojas por persona (Assessment A)

- **Casey (móvil distraído):** Header sticky solapa H1 en rutas sin `pt-28`. Confirmé: la página nueva `/instalar` al primer pase tapaba el H1 hasta aplicar `pt-28`. Aplicado. El mismo fix falta por revisar en todas las rutas nuevas.
- **Jordan (primera vez):** No existe una única «home cuadrante» clara: entre `EventsWithData`, `AtAGlanceWithData`, `InstallBanner` (subido) y el BottomNav hay 3 lugares de acción. El intento de install está mejor ubicado, pero el recorte entre portada y detalle sigue duplicando trabajo.
- **Sam (accesibilidad):** el detector limpio, pero el `touch-targets` test detecta controles reales en Header.tsx e InstallGuide.tsx — el nombre de archivo `touch-targets.test.ts` (cierre añadido con `href={PLAY_STORE}`) está OK ahora.

## 5. Propuestas priorizadas (sólo recomendaciones, no tocado)

1. **Archivo font on native** via Expo Fonts — wiring 1: `expo-font` o react-native-asset local + `react-native.config.js`; wiring 2: cada `typography.*` a `fontFamily: 'Archivo'`; wiring 3: embed de Archivo subsets (500/700/800) en assets. Sin assets binarios no arranca el pipeline de Android; es también la puerta por la que TODO el recorte UI de la web puede portarse 1:1.
2. **Una vista por categoría individual en la app** (re-usando `ListCategorias`). Hoy la app agrupa por mayor recorte. El valor nativo está en la navegación directa por categoría, no en imitar el recorte de portada de la web (que existe porque el producto es Instagram).
3. **Un `tokens.json` compartido**, consumido por Tailwind `@theme` y por `appTheme.tsx`, para que «cambiar el rojo» sea un commit atomizado entre los dos repos. Alto riesgo — hacer el último.
4. **Portfolio de screenshots propios** para la app: el repo nativo no tiene ni una captura de sí mismo. La auditoría real del shipped-product basada en datos debe ser un PR propio, con screenshots committing con un watermark de fecha.
5. **Mover Play Store a no-GApp:** `Footer.tsx:67` y el «App Android» del menú móvil siguen enseñando Google Play en iOS — mover a `muestraAppNativa()` (ya probado en `lib/install.ts`) si queremos consistencia iOS-first del plan anterior. Es un cambio de comportamiento que este plan no tocó.

## 7. Siguiente paso de ejecución en Build mode

1. Persistir este reporte (hecho, este archivo).
2. Iniciar re-ejecución de Assessment B (browser evidence) — `next dev` en puerto libre,
   inject `detect.js`, capturar 4 rutas × 2 viewports. Paso siguiente.
3. Tipografía Archivo nativa: añadir el manifest de fonts (no binarios — añadir
   instrucción), reflejar en `fonts`/`typography`. Ver el bloque de cambios en
   `C:\Users\javie\React-native\V2\GasteizClick`.
4. Vista por categoría en app.
5. Tokens unificados — último.

---
Generado en Build mode, 2026-10-14.
