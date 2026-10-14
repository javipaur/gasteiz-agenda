# Spec: vincular Archivo + JetBrains Mono en la app nativa

**Owner-decisión:** Javier. **Ejecutable por:** Javier (manual, build tooling).

## Goal
Que la app React Native use los mismos fonts que la web (Archivo para tutto, JetBrains Mono para lo tabular) en lugar de la sans del sistema.

## Estado actual
- `theme/appTheme.tsx`: `fonts.display/body = 'Archivo'`, `mono = 'JetBrainsMono-Regular'`.
- `typography.*` ya incluye `fontFamily: fonts.display`.
- `react-native.config.js` declara `assets: ['./assets/fonts']`.
- `assets/fonts/` creado vacío.
- `appTheme.tsx` exporta `colors` const.

## Trabajo requerido (javier)
1. Descargar los TTF `Archivo-{Regular,Bold,SemiBold,ExtraBold}.ttf` y `JetBrainsMono-Regular.ttf`.
2. Ponerlos en `React-native/V2/GasteizClick/assets/fonts/`.
3. Verificar nombres PostScript exactos:
   - `fc-list` / el inspector de fuentes — Archivo family suena `Archivo`; variantes son `Archivo-Bold`-style PostScript, dependen del OS y de cómo Ship el TTF.
   - Tip: `npx react-native link` vincula el **filename sin extensión** en iOS en menos de lo que esperas; la key `fontFamily` debería coincidir con lo que el inspector dice en un `Info.plist` de debug.
4. Ejecutar `npx react-native link ./assets/fonts` (o `npx react-native-asset` para RN 0.85+).
5. Android: confirmar fonts aparecen en `app/build/generated/assets/...` y el nombre case-insensitive coincide.
6. iOS (solo Xcode): AddResources.bundle → Info.plist `UIAppFonts` list.
7. Rebuild, verify H1 visually con la misma captura.
8. Si la typographic scale se ve más baja que en web → revisar `letterSpacing` and `fontWeight` para `800` con Archivo (RN 0.82 mapping varies por OS).

## Acceptance criteria
- An H1 of event title on native visually matches web tokenize weight/shape (capture comparison).
- `npx tsc --noEmit` y tests (33/33) continúan verdes.
- Si no hay binarios, el build sigue pasando sin error (fallback system-ui) — explícito en README.

## Referencias
- `appTheme.tsx` líneas: `fonts`, `typography`.
- `react-native.config.js`.
- Web tokens (`gasteiz-agenda/lib/tokens.json`, family `Archivo`/`JetBrainsMono`).