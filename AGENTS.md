# Gasteiz Click — memoria del proyecto

Agenda cultural de Vitoria-Gasteiz. Next.js 16 (App Router, RSC), React 19,
TypeScript estricto, Tailwind v4, 28 fuentes en el registro más 2 catálogos
sueltos, PWA, push, newsletter. Se despliega en Dokploy con `nixpacks.toml`
(Node 22).

## Qué es esto y para qué existe

**Esto no es una web de noticias ni un portfolio.** Es una agenda cultural de una
ciudad que ya tiene agenda, pero que la tenía repartida en 28 sitios sin cruce.
Aquí se junta, se normaliza y se enseña.

**El objetivo real es Instagram, y todo lo demás es secundario.** El producto
termina en un post de 1080×1350 que alguien sube a mano. Lo que se automatiza es
la preparación —elegir, ordenar, escribir el pie, dibujar las imágenes— y lo que
no se automatiza es la decisión de si el día merece publicarse.

**Quién publica es una persona, y se lee el correo antes de subir.** Esa es la
regla que manda sobre el diseño entero: ninguna parte del sistema puede publicar
por su cuenta. Por eso `scripts/enviar-promo.ts` **manda correo y no publica**,
y por eso el README dice que no hay token de Instagram en ninguna parte del
proyecto.

**Dos decisiones de negocio que no se deducen del código:**

- **El público objetivo incluye a las familias, no solo a la gente de salir.**
  Por eso `Infantil` pesa 26 en `lib/popularity.ts` —por encima de Teatro—: una
  familia no comparte nada con el resto del post, y sin nada para ellas ese
  público sigue sin aparecer por bueno que sea el resto.
- **Aparecer más días importa más que aparecer mejor.** El calendario municipal
  se publica con meses de antelación y su cola se vacía sola; el post sale los
  siete días porque medido el 13 de octubre de 2026 los catorce días seguidos
  tenían los seis planes completos.

### Lo que un modelo no puede deducir solo

- **La agenda se publica en euskera y castellano, con la ortografía de origen.**
  Los títulos vienen de 28 sitios sin esquema y **no se tocan**: ni se traducen,
  ni se corrigen las erratas, ni se ponen en mayúscula. Aparecen bajo una
  imagen generada, y un texto que no coincide con lo que se ve es un dato falso.
- **Una fuente caída y una fuente vacía no son lo mismo, y confundirlas cuesta
  usuarios.** Es el modo de fallo que este proyecto lleva corrigiendo desde el
  principio: un `return []` cuando la fuente falla hace que la agenda parezca
  que no hay nada. `Promise.allSettled` no distingue una cosa de otra.
- **`/api/actividades/*` es contrato con una app móvil de fuera.** Se consume
  con `x-api-key` y **la forma de la respuesta no se toca**: cambiar un nombre de
  campo rompe el cliente sin que nada falle aquí.
- **Los secretos no van al repositorio, ni en texto ni cifrados.** Por eso
  `MEC_TOKEN` y las credenciales de correo son variables de entorno y no claves
  en el código.

### Lo que no se hace aquí

- **No se publica en Instagram automáticamente.** Es una decisión editorial y un
  token en el repo no la vale. El MCP de Instagram está instalado en la máquina
  de desarrollo, pero el cron nunca lo usa.
- **No se pone un Dockerfile a servir la web.** Dokploy la construye con
  `nixpacks.toml`; el `Dockerfile` que hay es solo para el contenedor del cron.

## Comandos

```bash
npm run dev            # localhost:3000
npm test               # Jest
npm run lint           # ESLint (ver "baseline de lint")
npm run build
npx tsc --noEmit --incremental false   # typecheck real
npm run test:e2e       # Playwright
```

Y los del paquete de redes, que son con los que se trabaja a diario:

```bash
npm run doctor                    # comprueba todo el pipeline; sale con 1 si algo falla
npm run promo:send                # el cron: arma el paquete y lo manda por correo
npm run promo:casting [fecha]     # el casting de un día, sin mandar nada
npm run promo:presentacion        # el post de presentación suelto
```

**`npm run doctor` es la primera cosa que se ejecuta cuando algo no cuadra.** Se
puede lanzar en local contra producción, y en el servidor con `cd /app && npm run
doctor`. Comprueba las cuatro rutas de imagen **leyendo el cuerpo y verificando la
firma del PNG**, el paquete, el agregado, las variables, que `tsx` y `dotenv`
estén declaradas y que el modelo del casting responda.

## Estado (2026-10-01)

Rebrand F0/F1, unificación de la agenda (Fase 1), seguridad (Fase 2),
consolidación (Fase 3) y red de seguridad (Fase 4) cerrados y commiteados.
Fases 1 y 2 **desplegadas en producción**; la 3 y la 4 están commiteadas y
pendientes de desplegar. Baseline verde: `tsc` 0 errores, 424/424 tests, `build`
exit 0, y `npm run lint` sale con **0 errores** y 15 warnings que son todos
`catch (error)` sin usar.

Dos cosas siguen abiertas y **no son de código**: la rotación del token MEC en
el servidor de La Genterula, y la confirmación del volumen persistente en Dokploy.

## Hecho: el baseline de lint (el punto H de la Fase 4)

Empezar por «arreglar los 63 problemas» era la lectura equivocada, y contar no
servía: **cinco de ellos no eran deuda, eran bugs**, y se habrían tragado con el
resto. Los que de verdad eran bugs están arreglados, y lo que queda son 37
`no-explicit-any` en ficheros que no se arreglan aquí.

- **No hay baseline por recuento**, y el motivo es concreto: arreglar un `any` y
  añadir otro se cancelan, el total no se mueve y el rojo no aparece nunca. La
  lista de ficheros exentos sí detecta eso.
- **La lista está en `lib/lint-baseline.json`, no en `eslint.config.mjs`.** Un
  JSON se lee desde Node y desde TypeScript, así que el test consume la misma
  lista que la config. Y fuera de la config porque
  `__tests__/lint-baseline.test.ts` tiene que leerla: una lista escrita dentro de
  la config es un inventario, se deja atrás sin que nadie lo note, y entonces un
  `any` nuevo en un scraper ya exento no se distingue de silenciar uno de verdad.
- **El test corre ESLint de verdad.** Es lo que un recuento no puede hacer: un
  `any` en un fichero que no está en la lista es un rojo aunque el total no
  cambie.
- **El alcance es lo que hace la lista aceptable:** trece scrapers que leen JSON
  y HTML de sitios sin esquema, un script de un solo uso, y tres rutas que
  reproducen la forma cruda porque la app móvil la consume. **Ningún componente
  ni ninguna página**, y el test lo comprueba: ahí un `any` llega hasta la UI y
  sigue siendo un error.

### Los cuatro bugs que el recuento escondía

- **`CulturePageClient` leía `Date.now()` dentro del `useMemo`** que ordena por
  popularidad. Un memo que lee el reloj es impuro, y uno impuro puede devolver su
  valor cacheado indefinidamente: dejar la página abierta cruzando la medianoche
  seguía puntuando contra el «hoy» con el que se calculó la primera vez. La
  página pasa ahora el instante como prop.
- **`FavoritesContext` lee `localStorage` en un efecto**, y ahí la regla está bien
  en principio y mal en el caso. Un inicializador perezoso quita el `setState` e
  introduce un desajuste de hidratación: el servidor pintaría cero favoritos y el
  cliente ya en el primer render pintaría los reales, y `Header` pinta ese
  contador. El `loaded` tampoco es decorativo: es lo que impide que el efecto de
  escritura persista una lista vacía antes de que la lectura haya pasado.
- **`app/error.tsx` usaba `<a href="/">`** para un enlace interno, que es una
  carga completa de página donde bastaba una navegación de cliente.
- **`lib/sources/municipal.ts` declaraba `filterParts` con `let`** y nunca la
  reasignaba; venía del refactor anterior, que movió ese fetch a su propia función.

## Hecho: la red de seguridad (Fase 4)

Cinco de los cinco puntos, y los dos que faltan no son código. La lista de esta
fase estaba a medias equivocada: **`/api/cron/send-newsletter` no es una referencia
colgada**. `scripts/send-newsletter.ts` no hace ningún `fetch` a `/api/*` desde la
unificación: llama a `getProximosEventos()` directamente, y no hay config de cron en
el repo. La decisión está tomada y el motivo está en "Fases que quedan", que ahora
está vacía.

### El huso horario ya no es un test que no puede fallar

`process.env.TZ = "Europe/Madrid"` está en `jest.config.ts`, que se evalúa en el
proceso principal **antes** de bifurcar los workers, así que la variable llega
heredada al nascent. Dentro de un `beforeAll` no funciona: V8 fija la zona por
isolate al arrancar el worker, la asignación se lee de vuelta correcta y no cambia
nada. Está medido, no supuesto.

Lo que arregla no es el orden de los tests, es lo que un test **puede** detectar:
en UTC `localDateKey(d)` y `d.slice(0,10)` son la misma función para toda fecha, así
que media docena de tests no distinguían la implementación buena de un
`slice(0,10)` colado. `__tests__/huso.test.ts` convierte el `console.warn` en un
rojo: quitar el pin con `TZ=UTC` en el entorno tumba sus tres casos.

### jsdom es opt-in por fichero

`testEnvironment` sigue siendo `node` y jsdom entra con un docblock
`@jest-environment jsdom`. Ponerlo global costaría el doble a las 46 suites de
scrapers, que no usan el DOM. `testMatch` ahora recoge también `.tsx`: sin eso un
test de componente no solo fallaría, es que **no se recogería**, y el repo parecería
no tener ninguno.

El primer test de componente es `InstallBanner`, que la Fase 3 reescribió y que
nunca se había renderizado. La ventana de 72 h es justo lo que un componente puede
probar y un store no: se lee de `localStorage` en el inicializador de `useState`.

Dos trampas, ambas escritas en `__tests__/helpers-dom.ts`:

- **Una sola copia de React.** El store de `useInstallPrompt` es un singleton de
  módulo, así que cada caso recarga los módulos con `isolateModules`. Si el `act` y
  el `createRoot` vienen del registro antiguo, el componente se renderiza con
  **otra** copia de React y React dice "Invalid hook call" sin más. Por eso el
  helper recibe React como argumento en vez de importarlo, y por eso esos tests no
  usan JSX: el transform resuelve `jsx-runtime` del registro de fuera, que es
  justo la otra copia.
- **`IS_REACT_ACT_ENVIRONMENT`** lo pone `jest.setup.ts` solo cuando hay `document`,
  para que React deje de avisar en las 46 suites que no renderizan nada.

No se ha añadido `@testing-library/react`: `react-dom/client` y `act` ya están en
`dependencies` y los cuatro helpers hacen falta en diez líneas. Se cambia el día
que los tests de componente sean varios y necesiten consultas por rol o por texto.

### Push y mail: las decisiones que cuestan avisos a usuarios

- La **poda** de suscripciones se prueba desde los dos lados, y el interesante es el
  segundo: 404 y 410 significan que el endpoint ya no existe y la fila se va; un 500
  **no**, y tampoco el `TypeError` sin `statusCode` que lanza `web-push` sin red.
  Ensanchar la comprobación a "cualquier status definido" tumba el test, así que la
  regla no puede pudrirse en una bomba.
- La base de `node:sqlite` es **una por test** y no se borra entre ellos: SQLite
  mantiene el fichero bloqueado y tras `resetModules` el `rmSync` falla con `EPERM`
  en Windows. Se limpian todas al final, mejor que un `afterEach` que tumba la suite
  por un fichero abierto.
- `lib/mail.ts` hubo que tocarlo para poder testearlo: leía `EMAIL_USER`/`EMAIL_PASS`
  en el import y resolvía una sola vez tras `cachedResolved`, así que la primera
  llamada de un proceso decidía para siempre y el camino de producción era
  inalcanzable. El entorno se lee ahora dentro de la función. **La regla no cambia**:
  en producción, falta de credenciales es un error y no un mock. Revertirlo a una
  constante de módulo tumba el test.

## Hecho: la consolidación (Fase 3)

Tres refactors independientes, sin spec porque no había nada que decidir de
arquitectura: se unificó el `beforeinstallprompt`, La Blanca dejó de llevar el año
escrito, y el calendario municipal perdió su cuarto fetch a mano.

### `beforeinstallprompt` tiene una sola implementación

`lib/useInstallPrompt.ts` es el store y ya no había debate: `Header.tsx` e
`InstallBanner.tsx` tenían cada uno su listener, su interfaz de evento y su
`useState`.

- El store es `createInstallStore(target: EventTarget)` con una instancia por
  defecto ligada a `window`. Por eso su contrato se testea en node, con un
  `EventTarget` falso, sin esperar a que la Fase 4 traiga `jsdom`.
- **El bug que arregla:** `promptInstall()` solo anulaba el evento si el usuario
  aceptaba. `beforeinstallprompt` se dispara una vez por carga de página y
  `prompt()` lo consume, así que tras un descarte el siguiente clic llamaba a
  `prompt()` sobre un evento ya consumido y el navegador lo rechaza. Ahora lo
  descarta siempre, y lo hace **antes** de esperar a `userChoice`, para que entre
  el clic y la respuesta no quede un evento que otro clic reutilice.
- El descarte del banner se lee en el inicializador de `useState`, no en un
  efecto: `react-hooks/set-state-in-effect` lo prohíbe, y no hay desajuste de
  hidratación que tapar porque en servidor `useInstallPrompt()` ya devuelve
  `false` y el banner no se pinta.

## Hecho: la instalación de la PWA se ve (2026-10-14)

El PWA **ya era instalable** y el botón **ya existía**. Lo que no se veía. Tres
cosas distintas, y la que de verdad cuesta es la primera.

### iOS no tiene `beforeinstallprompt`, y eso no es un bug

Es un hecho de la plataforma: Safari no dispara el evento y no ha implementado
la instalación programática de una PWA. Como `InstallBanner` e `InstallButton`
estaban los dos gateados por `useInstallPrompt()`, **en iPhone e iPad el UI de
instalación no llegaba a renderizarse nunca** — no era que estuviera escondido,
era que no existía. Y el móvil que más usa el público de esta agenda es un
iPhone.

- `lib/install.ts` es **puro**: no lee `navigator`, no importa React, no toca el
  DOM. `esIOS(userAgent, maxTouchPoints)` y `metodoDeInstalacion(entrada)` se
  prueban enteros en node, en `__tests__/install-platform.test.ts`. Lo que sí
  necesita del navegador se le pasa dentro de `EntradaInstalacion`.
- **El iPad en Modo Escritorio** se anuncia como `Macintosh` y solo se
  distingue por el táctil. Sin ese caso, el iPad de quien usa un teclado físico
  cae en la rama de escritorio y se le ofrece un botón que nunca va a funcionar.
- **No hay animación que finja la hoja de compartir de iOS.** Miente, y iOS 26
  la rediseñó, así que el mock quedaría mal en el móvil de la mitad del público.
- **En iOS no se enseña el enlace a Google Play**, que en un iPhone es un sitio
  que no instala nada.

### El banner estaba a 21.000 píxeles del origen

Medido en producción el 14 de octubre de 2026: el documento en móvil de 390 px
mide **21.028 px**, y el botón "Instalar" estaba en el **`y=9776`**. En Chromium
el evento sí dispara —`Page.getInstallabilityErrors` devuelve `[]`, el service
worker está `activated`— pero once pantallas más abajo da igual. `InstallBanner`
bajaba de `app/page.tsx:361`, después de `EventsWithData`.

- `Header.tsx` tiene el icono de instalar en `hidden md:flex`, y el menú móvil
  solo ofrecía "App Android". En móvil no había ninguna superficie de
  instalación sobre el fold.
- Ahora hay tres: la entrada "Instalar la app" del menú móvil, la página
  `/instalar` y el banner subido tras `AtAGlanceWithData`.

### `display-mode` no es un evento, y por eso no es el mismo store

`createInstaladoStore(leer, suscribir)` **no** se construye sobre un
`EventTarget` como el del prompt, porque ahí no hay a quién escuchar:
`display-mode` es una media query. Las dos piezas que sí existen entran como
argumentos, y con un `leer` falso se prueba en node. Estado aparte y no un
`useState` porque la respuesta cambia sola: al volver de segundo plano con la
PWA recién abierta.

- El `isStandalone` que estaba escrito dentro de `Header.tsx` era una **tercera
  copia** de "¿estoy instalada?" que `InstallBanner` e `InstallButton` no
  consultaban. Los tres consumen ahora `useInstalado()`.
- Aplicar `display-mode` al store del prompt habría tapado solo el caso fácil:
  Chromium ya no dispara el evento para una PWA instalada. iOS es donde importa,
  y ahí no hay evento que gatee nada.

### El fallo que sale al pulsar "Instalar"

`prompt()` consume el evento en cuanto se pulsa. Con la página derivando la
tarjeta del método, el momento siguiente el botón se convertía en **"este
navegador no instala esto"** con el diálogo del navegador todavía delante.
`InstallGuide` guarda el estado del intento (`reposo`/`pidiendo`/`instalada`/
`descartado`) y **`accepted` se toma como instalada sin esperar al
`matchMedia`**, porque es el propio navegador diciendo que ya está. Dos tests lo
fijan: aceptar y descartar.

### Lo que sigue sin verificar

**Nada de esto se ha probado en un teléfono físico.** Todo lo anterior está
medido contra producción con Chromium headless a viewport 390 px, y el
heuristic de *user engagement* que Chrome aplica antes de disparar el evento no
se puede comprobar desde aquí. Sigue siendo un paso antes de dar esto por bueno.

Y quedan **dos superficies con el enlace a Play Store que se muestran en iOS**,
preexistentes y fuera de lo que se tocó: `Footer.tsx:67` y el "App Android" del
menú móvil (`Header.tsx`). En un iPhone ese enlace no instala nada. La regla
correcta ya existe y está probada — `muestraAppNativa()`—; lo que falta es
aplicarla ahí.

### La Blanca saca el año de los datos

El año estaba escrito en **cinco** sitios de `lib/sources/fiestas-blanca.ts` y en
cuatro más entre los componentes, la página y el endpoint. Los nueve morían igual:
el día que terminaba la edición, el rango pedido era del año anterior, el
calendario no devolvía nada, la sección se vacía y no se loguea nada.

- `blancaEditionYear(dates)` de `lib/blanca.ts` es el único sitio que sabe qué
  edición es esta: lo lee de las fechas que `calendariosID=513` ya devuelve.
- **La petición a GasteizHoy ya no puede ir en paralelo con la del calendario.**
  Su URL lleva el año dentro, así que depende de que la primera haya respondido.
  Fuera de temporada no hay año, y entonces no se pide: es la respuesta correcta.
- De paso, **27 peticiones pasaron a ser una.** `fetchAllDays` recorría el rango
  día a día en lotes de cinco para construir la misma consulta que
  `fetchMunicipalCalendar` emite una vez con su rango por defecto. Ese fetch se
  comparte ahora desde `municipal.ts` en vez de estar copiado, y su
  `AbortSignal.timeout` cubre las diez entradas municipales en lugar de solo una.
- Los fixtures son de **2027** a propósito. Con 2026, los tests passarían hoy y
  solo fallarían en agosto de 2027.
- El filtro de la etiqueta genérica pasó de `!== "La Blanca 2026"` a un patrón,
  por el mismo motivo.

### El calendario municipal tiene una sola puerta

`app/api/actividades/eventos/agenda/route.ts` era un cuarto fetch a mano de
`CalendarioServlet`, con tres copias de `municipal.ts` dentro (el regex del
`srcset`, el sufijo `_smart` y el aplanado de secciones) y la indentación rota.
Ahora usa `scrapeMunicipalCalendar` y decide solo la forma.

`__tests__/api/actividades-agenda.test.ts` es el primer test de route handler del
repo, y está en esa ruta porque es la que tenía la forma en riesgo: fija el
conjunto cerrado de claves, los tipos y el `calendariosID`.

## Hecho: la agenda unificada (Fase 1)

Cerrada. El diseño está en
`docs/superpowers/specs/2026-09-30-agenda-unificada-design.md` y el plan por
tareas en `docs/superpowers/plans/2026-09-30-agenda-unificada.md`. Los dos P0
—el 404 de `/evento/[slug]` y los favoritos que se apagaban solos— están
cerrados, medidos y con test.

### Cómo queda

- `lib/source-data.ts` es la **hoja pura** del registro de 28 fuentes: no importa
  nada. `lib/source-registry.ts` es la composición que le une las funciones de
  scraping. `lib/utils.ts` y `lib/tickets.ts` derivan de la hoja, nunca del
  registro compuesto.
- `lib/agenda.ts` es el **agregador único**. `id === slug`, siempre, y el slug lo
  decide una sola vez en `normalizeRaw`.
- `lib/eventos.ts`, `lib/cultura.ts`, `lib/deporte.ts`, `lib/kids.ts` y
  `lib/conciertos.ts` son **vistas**: filtran el agregado, no scrapean. Una sola
  clave de caché, `agenda-all`, TTL 5 min.
- Las tarjetas y el JSON-LD usan `e.slug`. Un evento crudo se normaliza con
  `agendaSlug()` de `lib/slug.ts`, que aplica el mismo trim y el mismo
  tratamiento del `"#"` que `normalizeRaw`.
- Los favoritos se recuperan al leer: `FavoritesContext` rehace el id con
  `migrateFavorites`, así que los que ya estaban guardados sobreviven.
- `lib/popularity.ts` pesa por `group`, no por id, para que una variante municipal
  nueva herede el peso sin tocar la lista.

### Decisiones tomadas (no revertir sin motivo)

- **`category` y `kind` son campos distintos.** `category` es taxonomía cultural y
  alimenta colores/SEO/`/culture`; `kind` es el tramo del calendario
  (`agenda | calendario | inscripciones | excursiones`) y filtra `/deporte`.
  No se fusionan porque `normalizeCategory` colapsa `excursiones` → `Senderismo`.
  Hay un tercer eje, `tags`, para "infantil" y "La Blanca".
- **Los favoritos se recuperan, no solo se dejan de romper.** El objeto guardado
  tiene `{id, title, date, link}` y el slug se recalcula de título+fecha+enlace.
- **Las URLs no cambian.** `eventSlug` no depende del `id` ni del nombre de la
  fuente. Lo que cambia es que la mayoría de eventos *ganan* detalle.
- **`/culture` pasa a ser una vista.** El colapso a 4 cubos
  (`teatro|conciertos|exposiciones|agenda`) se queda como filtro sobre
  `mapToCultureCategory`; `category` guarda las 15 categorías reales.
- **`/conciertos` agrupa por id de registro, no por recinto.** Antes derivaba
  `venue.toLowerCase().replace(/\s+/g,"-")` y agrupaba por `"jimmy-jazz-gasteiz"`
  mientras `isTicketSource()` comparaba con `"jimmyjazz"`, así que la única sala
  que vende entradas decía "Más información". Y el recinto era inventado por el
  scraper, no por la fuente: es justo lo que el registro vino a arreglar.
- **Una fuente sin fecha no entra en el registro.** Es la regla que decidió
  Civitatis y Kora, y conviene no reelegirla a la ligera: `normalizeRaw` descarta
  lo que no tiene fecha válida, y las dos publican *sesiones recurrentes*
  ("Free tour por Vitoria", "Martes de 19:15h a 20:15h") sin fecha concreta.
  Registrarlas obligaría a fabricar una —la siguiente ocurrencia del día de la
  semana— y eso mete fechas falsas en la agenda, en el detalle y en el JSON-LD.
  Se exponen como endpoint propio, con el horario literal, y las consume
  `/turismo`. Si algún día se quieren en la agenda, el sitio tiene que publicar
  calendario; no lo resuelve el scraper.

### Las tres fuentes migradas de `demo-next-js`

Eran 21 route handlers de scraping, de los que 18 ya existían aquí con mejor
implementación. Las tres que faltaban:

| Fuente | Cómo entra | Por qué |
| --- | --- | --- |
| `mercado-abastos` | Registro, `priority: 4` | Tiene fechas de verdad, vía la API REST de The Events Calendar |
| `civitatis` | Endpoint suelto `/api/actividades/tours/civitatis` | Recurrente, sin fecha |
| `kora` | Endpoint suelto `/api/actividades/experiencias` | Recurrente, sin fecha |

Las tres dejaron de necesitar Puppeteer. Ninguna lo necesitaba: Mercado de
Abastos expone `/wp-json/tribe/events/v1/events` con los eventos ya
normalizados, y Civitatis y Kora traen las tarjetas en el HTML inicial. Eso
ahorra ~300 MB de Chromium en la imagen de Dokploy y mantiene los tres dentro
de la convención de tests del repo (`mockFetchWith` + fixture), que con Puppeteer
no funcionaba.

`/api/actividades/tours` y `/api/actividades/tardeo` **no se han tocado**: son
vistas sobre el agregado y las deja el registro. `/api/actividades/tours` sigue
siendo un filtro por categoría, así que las fichas de Civitatis no entran ahí
todavía; la ruta de Civitatis es aparte a propósito.

### Fuentes con credencial: no, mientras sean de una persona

El club **010 taldea** de Strava (`strava.com/clubs/2302100`, el "010" es el
prefijo postal de Vitoria) publica eventos que serían de la Agenda. La decisión
tomada es **no integrarlos**, y el motivo tiene tres partes, por orden de
importancia.

**No se puede ni comprobar que sirvan de algo.** Los eventos no están en el HTML
público —0 apariciones de `event_date` o `group_event_start` en los 637 KB que
devuelve `GET /clubs/2302100`; lo que hay son cadenas de traducción del bundle de
JavaScript—. Y `og:description` de la página es literalmente *"Log in to see
010 taldea"*. Es decir: **no hay forma de saber cuántos eventos tiene** sin
autenticarse. Se estaría añadiendo una dependencia permanente para un dato cuyo
tamaño se desconoce.

**Sería la primera credencial que es de una persona y no del proyecto.** Las 28
fuentes son públicas. La única credencial que hay, `MEC_TOKEN`, es compartida y
está documentada como *no secreta* porque además se publica en el bundle de
Kiosko Cultura. Un `access_token` de atleta es otra cosa: pertenece a una cuenta,
y esa cuenta puede revocar la autorización, dejar el club, o simplemente cambiar
de contraseña.

**Y reintroduce el fallo que este repo acaba de eliminar.** Una fuente que
devuelve `[]` porque el token ha muerto es indistinguible de un club sin
eventos, que es exactamente el modo de fallo que se corrigió en `municipal`,
`rula`, `farmacias` y `search`. `SourceEntry` no tiene ningún campo para
declarar que una fuente es de las que necesitan credencial, y no se va a
añadir uno para admitir un único club.

Medido, por si hay que volver a mirarlo: `GET /api/v3/clubs/2302100/group_events`
responde **401** sin token, y `robots.txt` de Strava tiene `Disallow: /api/` para
`User-agent: *`. Es decir, **no se puede raspar**: la API oficial pide
autenticación y el HTML no tiene los datos.

Lo que sí se haría, si el club publica su calendario en su propia web o en
redes, es entra por el camino normal: una fuente pública más, con fixture y
test, como las otras 28. Si algún día eso deja de ser cierto —Strava es el único
sitio donde están— y hay un valor demostrado, la decisión se revisa con el
número delante, no con la intención.

### Fases que quedan

**Nada.** Las cuatro fases están cerradas.

La decisión que quedaba —crear o no `/api/cron/send-newsletter`— es **no**, y el
motivo importa porque no era el que decía la lista:

- No era una referencia colgada. Desde la unificación `scripts/send-newsletter.ts`
  no hace ningún `fetch` a `/api/*`: llama a `getProximosEventos()` directamente,
  y no hay config de cron en el repo. Crear la ruta era una decisión nueva.
- Y la ruta es peor que el cron para lo que hace. `instrumentation.ts` ya arranca
  un trabajo programado en el proceso para el push (`ENABLE_PUSH_SCHEDULER=1`), así
  que un segundo `setInterval` habría sido el camino corto y coherente. No lo es:
  el scheduler en proceso depende de que el proceso de Next siga vivo, y
  `/api/push/send` existe para poder dispararlo **desde fuera**, para el caso de
  que se haya caído. Con una ruta de newsletter no habría ese camino de
  recuperación, porque el correo no tiene equivalente de "reintentar a los que no
  salieron" en `lib/db`. Una newsletter a medias no se puede reanudar.
- Lo que queda es que **Dokploy corra `npm run newsletter:send` como cron**, que
  es lo que el script está pensado para desde su comentario de cabecera. Eso no
  se puede comprobar desde el repo.

Fuera de alcance, anotado para que no se pierda: el rate limit en `Map`
in-memory no se arregla sin store compartido.

## Trampas del repo

- **Una imagen de `ImageResponse` se rompe si un `<div>` tiene más de un hijo y no
  declara `display: flex`, `display: contents` o `display: none`.** El síntoma es un
  **502 sin cuerpo** y casi nada en el log, porque el fallo ocurre a mitad del
  stream. Hay dos formas de dispararlo, y las dos Fallaron en producción:
  `{dia} {mes}` —dos interpolaciones más el espacio— y un ternario que puede
  devolver un número o una cadena. **`__tests__/promo-og-layout.test.ts` recorre el
  JSX con el AST de TypeScript y las cazaría**, porque los tests de estas rutas solo
  miran cabeceras y `ImageResponse` es perezoso: un test que no lee el cuerpo no
  puede fallar. Y `next build` tampoco las caza, porque son rutas dinámicas.
- **Un script suelto con `tsx` no carga el `.env`, y `AsyncLocalStorage` no es
  global en Node 24.** Los dos se resuelven con `prepararEntornoScript()` de
  `scripts/entorno.ts`, **y tienen que ir antes de cualquier import de `lib/`**,
  que es donde revienta. El fallo del segundo es
  `TypeError: globalThis.AsyncLocalStorage is not a constructor`, y con el apaño
  original —`typeof ... === "undefined"`, que acepta un valor presente pero no
  construible— salta más tarde y con un error que no señala el sitio.
- **`opencode run` no lee el prompt de `argv`, y `execFile` no encadena stdin.** En
  Windows hace falta `cmd /c` porque `spawn` no lanza un `.cmd`, y `cmd /c` no
  propaga stdin al proceso de al lado. Todo eso está resuelto en
  `scripts/opencode.ts`; **se llama desde ahí y no se copia**, porque una copia se
  queda con la versión vieja y falla con un `Command failed` sin explicación.
- **La API de `CalendarioServlet` se pide por mes, y la cola se vacía sola.** Un
  rango vacío **que empieza dentro de un mes** es una avería y se propaga; uno que
  empieza dentro de tres meses es la cola del calendario y no se toca. Medido el 13
  de octubre de 2026: 908 eventos en el mes que viene, **36 en el que acaba a los
  seis meses**. Sin esa distinción, las 17 fuentes `municipal-*` caen el mismo día.
- **`tsx` y `dotenv` tienen que estar en `dependencies`, no solo en el repo.**
  `npx` los resuelve en local y por eso la omisión es invisible hasta que el cron
  corre en el contenedor, que es donde ya no puede bajarlos.
- **`.tmp/` estaba en `.gitignore` pero no en los ignores de ESLint.** El
  recuento de problemas dependía de qué scripts de un solo uso la máquina de
  quien ejecutaba el lint hubiera dejado ahí. Si añades un directorio de trabajo,
  va en los dos sitios.
- **La base de `node:sqlite` se queda bloqueada en Windows**, así que un
  `rmSync` de una base de prueba tras `jest.resetModules()` falla con `EPERM`
  casi siempre: el `DatabaseSync` viejo sigue referenciado hasta que pase el GC.
  Por eso `__tests__/helpers-push.ts` crea un directorio por test y **no** borra
  entre ellos; limpia todos al final y traga el fallo. Un `afterEach` que limpia
  tumba la suite entera por un fichero abierto.
- **Todas las páginas usan `pt-28` por el header fijo, y no es una preferencia de
  espaciado.** Con `py-12` el H1 de `/instalar` quedó medio tapado; se vio
  renderizando a 390 px, no leyendo el código. El motivo largo está escrito en
  `app/hoy/page.tsx` y las otras quince páginas copian el valor.
- **Un `{/* … */}` de JSX entre atributos no compila**, y el error que sale es un
  500 con `Expected '</', got '}'` en la página entera. Pasa por debajo de
  `npm test` si se edita después de la última pasada, así que la comprobación de
  que sigue valiendo es **mirar la página**, no volver a correr los tests.
- **`process.env.NODE_ENV` es de solo lectura en los tipos**, y los tests de mail
  necesitan cambiarlo para mirar los dos lados de la regla del mock. Se escribe con
  un cast a `Record<string, string|undefined>` en vez de un `// @ts-expect-error`
  que alguien acabaría borrando.
- **`@typescript-eslint/no-require-imports` está justificada en
  `__tests__/components/`**, con `eslint-disable` línea a línea y su motivo. Es el
  único sitio del repo que usa `require()`, y es a propósito: `jest.isolateModules`
  aísla un registro sincrónico y un `import` estático se resolvería antes de que
  empezara. Desactivar la regla para `__tests__` entero sería tirar la excepción
  justo donde no hace falta.
- **El aviso `Dynamic server usage` durante `next build` es preexistente** y sale
  en varias rutas a la vez. Viene de que la home siempre llamó al agregado, cuyo
  fetch es `no-store`. Los scrapers lo capturan y devuelven lista vacía, así que
  el build sale 0. Si aparece en una ruta **nueva**, eso sí es información: significa
  que esa ruta se ha salido de la generación estática por el motivo equivocado.


- **Nada alcanzable desde un componente cliente llega a un módulo de servidor.**
  Hay dos caminos y los dos importan: `lib/sources/` (los scrapers) y cualquier
  cosa que importe `cheerio`. El grafo de imports de
  `__tests__/source-data.test.ts` los recorre desde todas las raíces `"use client"`.
  Es el mismo patrón hoja/composición: datos sin imports en un lado, scrapers en
  la composición. Un `import * as paquete` no se poda aunque nadie use el
  paquete: Turbopack dejó 148 KB de cheerio en el cliente durante semanas, y
  cuando se movió `fetchOgImage` a un módulo de servidor el chunk desapareció
  entero. Ese es el patrón a seguir cuando algo grande se cuele.
- **La regla de ESLint `no-restricted-imports` protege el slug.**
  Prohíbe importar `eventSlug` a pelo en `app/`, `lib/` y `scripts/`, con
  `importNames` para que siga al símbolo aunque se renombre al importar
  (`import { eventSlug as sl }` se colaba en el guard anterior). Un evento crudo
  pasa por `agendaSlug()`; un `AgendaEvento` usa su campo `slug`. Ya no hay
  excepciones: las dos que quedaban eran los ficheros de `/conciertos`.
- **Un `crypto.randomUUID()` sobrevive dentro de los scrapers y es correcto.**
  `lib/sources/municipal.ts:58`, `euskadi.ts:52`, `gasteizhoy.ts:132` ponen un id
  propio, pero `RawLike` no declara campo `id`: el agregador lo descarta antes de
  construir el `AgendaEvento`. La restricción era "nada en la ruta de datos", y la
  ruta de datos es el agregador, no el interior de un scraper.
- **El `mtimeMs` del sistema de ficheros va por delante de `Date.now()`.** Medido
  en esta máquina: entre 2 y 3 ms. Por eso un test de TTL que se fíe del signo de
  `age = Date.now() - stat.mtimeMs` es intermitente, y por eso los tests de caché
  fijan el reloj. No "arreglar" uno de esos tests cambiando el TTL: el margen
  tiene que venir del reloj, no de la aritmética.
- **PowerShell 5.1 corrompe la codificación de los ficheros con acentos.** Byte a
  byte aparecen los tres casos: `-replace` y `Set-Content -Encoding UTF8` producen
  mojibake y `seÃ±ala`; `Set-Content -Encoding UTF8` además mete un BOM de 3
  bytes. En este repo, ficheros con acentos solo con la herramienta de edición, o
  con `[System.IO.File]::WriteAllText` y `UTF8Encoding(False)`. Leer para
  inspeccionar necesita `-Encoding UTF8` explícito.
- **Un dev server matado a mitad deja `.next/dev/types/routes.d.ts` truncado** y
  `tsc` aborta en fase de parseo sin reportar ningún error real, lo que parece un
  typecheck roto cuando no lo está. Se arregla borrando `.next/dev` y pidiendo
  una página al server.
- **`/api/actividades/*` es contrato con la app móvil.** Con `x-api-key`, pero
  las consume un cliente de fuera: la forma de su respuesta no se toca. Sus
  `source:` del envelope (`"agregado"`, `"cm-gazteiz"`, `"vitoria-gasteiz"`) no son
  ids del registro **a propósito** y no se corrigen: describen de dónde sale la
  lista, no de qué fuente es cada evento, y cambiar el string le deja al cliente
  sin resultados sin ningún error en el servidor. Los eventos de dentro sí llevan
  su id real.
- **El calendario municipal tiene tres ventanas distintas para la misma fiesta**,
  y eso es un bug pendiente: `lib/season.ts:15` dice 4–9 ago, `lib/blanca.ts:1-4`
  dice 15 jul–12 ago, y `fiestas-blanca.ts` ya no dice ninguna. No se mezcló con
  la Fase 3 porque es otra decisión.
- **`fetchMunicipalCalendar` es la única puerta al calendario**, y por eso lleva
  `cache: "no-store"`. Eso hace que Next la marca `revalidate: 0`, con lo que
  cualquier ruta que la use se sale de la generación estática y se compila como
  dinámica. El aviso `Dynamic server usage` durante `next build` es **preexistente**
  y esperado: viene de que la home siempre llamó al agregado. Los scrapers lo
  capturan y devuelven vacío, así que el build sale 0.
- **Rula descarga 6,5 MB por petición** (`lib/sources/rula.ts`): Next no cachea
  fetches de más de 2 MB, así que la entrada del registro declara
  `cacheTtlMs` y su `run` se cachea por su cuenta. Con TTL de 2 h son ~79 MB al
  día en vez de 1,9 GB. Y `lib/cache.ts` deduplica peticiones en vuelo, para que
  una caché fría no dispare N descargas a la vez. El coste es que **un fallo
  puntual de una fuente se queda cacheado 2 h**; `scrapeRula` avisa por consola
  y devuelve vacío si falta `MEC_TOKEN`, en vez de gastar 6,5 MB en un 500.
- **El token MEC viene de `MEC_TOKEN`, no del código, y no es un secreto.**
  Medido: sin token o con uno falso la API responde 500, y no hay ruta pública
  que lo sustituya (`wp-json/wp/v2/mec-events` responde sin token pero su
  `content` es solo la descripción, sin fecha, hora ni lugar). Kiosko Cultura lo
  publica en su bundle JS. Sacarlo del código no lo revoca ni lo saca del
  historial de git: hay que pedir a La Genterula que lo revoque.
- **`.data/push.db` y `data/subscribers.json` escriben en disco** y se pierden en
  cada redeploy si Dokploy no tiene volumen persistente montado. No es
  verificable desde el repo. `README.md` lo advierte. `subscribers.json` además
  ya no está versionado y su ruta sale de `SUBSCRIBERS_PATH`.
- **El envío de correo falla de forma explícita en producción** si faltan
  `EMAIL_USER`/`EMAIL_PASS` (`lib/mail.ts`): devuelve `ok: false` y
  `scripts/send-newsletter.ts` sale con código 1. Fuera de producción hace mock.
  No revertir esto a `ok: true`: era un fallo silencioso que hacía pasar por
  enviada una newsletter que no llegaba a nadie.
- **Los tests de scraper usan fixtures con `mockFetchWith`/`loadFixture`, no
  red.** Pero un fixture con fechas fijas se pudre: `loadFixtureWithFutureDates`
  (`__tests__/helpers.ts`) reescribe las fechas a futuro conservando el formato.
- **`sourceLabel` (`lib/utils.ts`) es una lista blanca derivada del registro.**
  Un id que no esté en `SOURCE_DATA` se enseña tal cual, en mayúsculas, en la pill
  de cada tarjeta, sin error. Dos comprobaciones en `__tests__/source-data.test.ts`
  vigilan que nadie escriba un `source:` a mano: ninguna vista ni ninguna lista de
  ids puede salirse del registro.
- **La taxonomía de `lib/categories.ts` es de 15 categorías**; `CULTURA_CATEGORIAS`
  son 4 cubos de vista y no sustituyen a la anterior.
- **Civitatis y Kora esconden la imagen real en `data-src`.** En las dos, el
  `src` es un placeholder —un gif de 1px en base64 en Civitatis,
  `/assets/images/blank.png` en Kora— y el `srcset` llega vacío. La URL buena va
  en `data-src`; en Kora es una lista de tamaños separada por comas y sirve la
  primera. Leer `src` da una imagen rota que parece correcta en el test.
- **Mercado de Abastos devuelve `title` como string plano**, no como
  `{rendered}`: el REST de The Events Calendar lo difiere de `content.rendered`
  y `excerpt.rendered`, que sí vienen envueltos. Y sus `start_date` son
  `"YYYY-MM-DD HH:mm:ss"` en hora de Europe/Madrid **sin offset**, igual que las
  del Ayuntamiento: hay que interpretarlas como hora local, no como UTC.
  actualmente el mercado no publica nada upcoming —los 24 eventos que devuelve son
  de 2024—, así que no aparece en la agenda y es lo esperado.
- **`podar()` corta por reloj y no por identidad**, así que no sirve para deshacer
  una fila concreta, y la tentación de usarlo para eso es una trampa de las dos
  malas: `podar(t - 1)` no quita la fila de `ts = t` porque `t < t - 1` es falso, y
  `podar(t + 1)` se lleva **toda la tabla**, porque cualquier fila real es más
  nueva que una marca de prueba. Para quitar exactamente una fila está
  `desanotar(nombre, ts, ruta)`, que va por identidad y usa `ruta IS ?` y no `=`
  —en SQLite `= NULL` nunca es cierto, así que el `=` equivocado devuelve `0`
  contra una base sana y parece "la fila ya no estaba"—.
- **El limitador de `middleware.ts` no llega a las rutas públicas**, porque
  `isPublicApiRoute` devuelve mucho antes de la comprobación de clave y por tanto
  también antes del limitador. Una ruta en `PUBLIC_API_ROUTES` tiene que protegerse
  sola si está abierta a propósito: hoy solo la protege `lib/api-rate-limit.ts` en
  el `POST` de `/api/metric`, con 60 por minuto. Sin IP **no** se rechaza, y esa
  decisión tiene test a propósito.
- **Una comprobación con un absoluto no distingue "no funciona" de "ya había datos".**
  El caso fue `resumen().porEvento.visita < 1`: con 500 visitas de fondo daba
  `false` y anunciaba `[OK]` con la escritura rota. Cuando la pregunta sea "mi
  escritura entró", lo que la responde es el **delta** entre antes y después.

## Los fallos que no se ven

Cuatro de los que más caro han salido, y todos tienen la misma forma: **no
dan error, dan silencio.**

- **`MEC_TOKEN` puede estar caducado y todo parecer bien.** `scrapeRula` devuelve
  `[]` en vez de fallar, la salud sigue en 37/37 y el correo simplemente no sale.
  Por eso `npm run doctor` lo pregunta **contra la API** y no comprueba que la
  variable esté puesta: un chequeo de presencia no sirve para una credencial que
  puede haber caducado.
- **Una fuente caída para el correo solo si no es tolerable.** `rula` es la única
  con credencial, y su caída ya dejó el cron sin poder publicar durante días con
  36 fuentes sanas. `FUENTES_TOLERABLES` en `scripts/enviar-promo.ts` lo dice en un
  `Set`, y la tolerancia no se extiende en cadena: `rula` más otra es un agregado
  a medias de verdad.
- **`npx` esconde una dependencia que no está declarada.** `tsx` no estaba en
  `package.json` durante meses y todo funcionaba en local; en producción `npx` lo
  descargaba en cada ejecución del cron.
- **La agenda devuelve vacío en silencio cuando falta la fuente que la sostiene.**
  Una lista vacía es indistinguible de un día sin planes, y por eso hay puertas: la
  de salud para los datos, el mínimo de tres para el día.

**La forma de todos ellos es la misma: no se depuraron hasta que algo se
midió.** Por eso `npm run doctor` existe y por eso los tests de estas rutas leen el
cuerpo en vez de las cabeceras.

## Commits

Estilo conventional commits, scope en castellano, descripción en inglés.
Ejemplos: `feat(scrapers): enrich euskadi pagination and municipal fields`.

## Hecho: se puede contar cuánta gente entra y cuánta instala (2026-10-15)

La pregunta era "cuántas personas visitan la web y cuántas se instalan la
aplicación", y las dos cosas ya se sabían en algún sitio pero en ninguno que se
pudiera mirar.

### El dato que faltaba ya se estaba midiendo y se tiraba a la basura

`useInstalado()` lee `display-mode: standalone`, que es exactamente la pregunta
"¿está esta PWA instalada?". Lo que pasa es que **eso no viaja en ninguna
petición**: el servidor ve un `GET /` de una PWA instalada y el mismo `GET /` de
una pestaña de Chrome, y para él son la misma línea de log. Por eso el contador
sale del navegador (`app/components/Metricas.tsx`, montado en el layout al lado
del `<Analytics />` que ya existía) y no de un middleware.

### `Analytics.tsx` ya estaba y nunca se había puesto

`app/components/Analytics.tsx` monta un `<Script>` externo con
`NEXT_PUBLIC_ANALYTICS_URL` y `data-domain`, o sea la forma de Plausible. La
variable **no está definida en ningún `.env`**, así que el componente devuelve
`null` y no carga nada. Se deja como estaba: es el hueco correcto para un
script externo si algún día lo quieres, y ahora mismo no duplica nada porque un
script de terceros contaría visitas a `/instalar`, **no instalaciones**.

### La asimetría del `POST` y el `GET` es el diseño entero

`/api/metric` está en `PUBLIC_API_ROUTES`, así que el middleware la deja pasar
**antes** de mirar la clave. De ahí las dos mitades:

- El `POST` lo llama el navegador desde un componente cliente, que no puede
  traer `API_KEY` porque no se publica. Exigírsela haría que cada visita
  devolviera 401 y el contador no subiera nunca: el mismo modo de fallo que
  escondía los `console.warn` del cliente hasta que `/api/log` se añadió.
- El `GET` **sí** exige la clave, comprobada **a mano en la ruta**, porque una
  ruta que el middleware ya dejó pasar nunca llega a su comprobación. Sin eso,
  cualquiera que adivinara la dirección vería cuánta gente entra.

Y lo que hace insecurizable el `POST` no es la ruta sino el cuerpo: el nombre tiene
que estar en la lista cerrada de `lib/metricas.ts` y el techo es de 1 KB. Con un
`string` libre, cualquiera que descubriera la ruta inflaría la tabla, y **un
contador inflado es peor que no tener contador** porque es un número que miente y
que nadie va a mirar dos veces.

### `visita` no es "personas", y el código lo dice

No hay cookie ni huella. `sessionStorage` es memoria de la pestaña: no viaja, no la
ve el servidor, no pide consentimiento y desaparece al cerrar. El coste es que
`visita` cuenta **pestañas**, no gente, y quien recargue cinco veces cuenta
cinco. La cifra que sí es de fiar es `instalada`, y no por ser un contador sino
porque **sólo la emite quien está en modo standalone**: es un estado del navegador,
no una acción que alguien pueda fingir desde la red.

### El `ts` del cliente se acota, y por qué el recorte no es opcional

`anotar()` recibe el `ts` del navegador, no el del servidor, porque el reloj de
un contenedor en Dokploy puede ir desviado. Pero un `POST` público con un `ts` de
`0` pondría la fila tan atrás que la primera poda se la comería, y uno de `1e18` la
dejaría fuera del alcance de cualquier poda: los dos vacían o congelan el
contador. `ahoraDelCliente` acota a ±1 h y cae al reloj del servidor.

### Lo que `promptInstall()` no notificaba

`InstallButton` y `InstallGuide` consumen el resultado de `promptInstall()` cada
uno con su propio estado, así que quien solo quería **contar** no tenía a quién
escuchar. `alResultado(oyente)` en `lib/useInstallPrompt.ts` resuelve el hueco, y
la notificación sale del store y no de un `CustomEvent` en `window` porque el
store es el único sitio donde está la respuesta.

### Verificado, no supuesto

- `tsc` 0 · **1112/1112** tests · lint 0 errores (16 warnings, baseline) · build 0.
- En navegador de verdad: dos cargas de `/` en la misma pestaña emiten **un**
  `POST`, y el `GET` sin `x-api-key` devuelve **401**.
- El panel con la clave devuelve `{"visita":2,...}`: las filas llegaron a la base.

Las dos guardas que rompieron al añadir la ruta son las que existen para esto:
`__tests__/middleware.test.ts` exige la lista **exacta** de públicas con su motivo
(el caso se llama "catorce" y el número está en el nombre), y
`__tests__/openapi.test.ts` contrasta el recuento del documento contra el disco.

## Hecho: el contador deja de depender del push (2026-10-16)

Tres arreglos que comparten una forma: **una puerta que controla dos cosas, y una
comprobación que no puede fallar.** Los dos son silenciosos, que es la razón por la
que están aquí.

### Apagar el push apagaba también la poda

`instrumentation.ts` tenía `if (ENABLE_PUSH_SCHEDULER !== "1") return` **antes** de
arrancar nada, y de ahí colgó después la poda de métricas. El efecto: sin push no
arrancaba `lib/scheduler.ts`, así que `podarSiToca()` no se llamaba nunca y
`metricas.db` crecía para siempre. No salía ningún error, porque no fallaba nada:
simplemente nadie pasaba por ahí.

Y apagar el push es razonable —es una función opcional, y hay despliegues que no
quieren el digest—, así que una decisión sobre una función no puede silenciar una
tabla que crece sin límite en el mismo volumen.

Ahora hay dos banderas (`SchedulerOpciones`) con su puerta cada una, y **cada `if`
lleva su motivo escrito**, porque "por qué está esto aquí" es la pregunta que se
hace en la revisión y con un solo motivo no la responde.

La poda va además en su propio `try`, antes del digest: si un scraper está caído y
el digest lanza, el `catch` de abajo se come el error y la poda no llegaría a
ejecutarse en un día con la agenda rota, que es justo el día en que más falta hace
que la tabla no crezca.

### El limitador del middleware no llegaba a las rutas públicas

`middleware.ts` limita a 100 peticiones por minuto y por IP, y está bien puesto
para las rutas **protegidas**. Pero devuelve mucho antes, en `isPublicApiRoute`: una
ruta pública nunca llega a la comprobación de clave, y por tanto tampoco al
limitador. Con `/api/metric` en la lista, el `POST` del contador quedaba **sin
ningún límite**, y esa ruta está abierta por necesidad —la llama un componente
cliente que no puede traer `API_KEY`—.

`lib/api-rate-limit.ts` es un `Map` en memoria con 60 por minuto. Son 60 y no 600
porque cada petición aceptada escribe **exactamente una** fila, así que el límite
de peticiones es también un límite de filas; y el tráfico real del sitio es de
unas 2.000 visitas al día entre todo, y ningún visitante legítimo manda más de uno,
porque `Metricas` no reintenta.

**Sin IP no se rechaza, y esa decisión tiene test.** Sin IP no hay contra quién
contar, y las dos salidas son malas: rechazar deja el sitio entero sin métricas sin
un solo error, y dejar pasar deja un hueco. Se elige el hueco porque un hueco se
ve —el contador no cuadra— y un rechazo silencioso no.

La limitación de ser un `Map` en memoria es la misma que ya tiene anotada el
limitador del middleware: en varios procesos cada uno lleva su cuenta. Aquí es
aceptable porque el objetivo no es contabilidad exacta sino que el número no se
pueda inflar sin factura.

### El `doctor` comprueba que las métricas **escriben**

`Metricas.tsx` se traga el fallo del `fetch` a propósito, para que un contador
caído no pueda dejar de servir la web. El precio es que un `metricas.db`
ilegible —volumen no montado, disco lleno, permisos— **no produce ningún error en
ningún log**: el contador se congela y sigue contando en apariencia. Semanas
después se abre el panel y se ve un número parado que parece "pocas visitas".

Es el mismo modo de fallo que ya corrigió el resto del repo, y con la misma
solución que se aplicó a `MEC_TOKEN`: **no comprobar que la variable esté puesta,
sino usarla**.

### Y aquí estaban las dos comprobaciones que no podían fallar

Lo primero que escribí funcionaba y estaba mal en dos sitios a la vez.

**Dejaba una visita falsa por ejecución.** La fila de prueba se limpiaba con
`podar(marca - 1)`, y `podar` corta por tiempo: `marca < marca - 1` es `false`, así
que **la fila nunca se borraba**. El contador ganaba una `visita` cada mañana,
para siempre. Y el arreglo "obvio" es mucho peor: `podar(marca + 1)` sí la quita,
y con ella **toda visita real jamás registrada**, porque todas son más nuevas que
la marca. Comprobar que algo está roto y luego borrar los datos no es comprobar.

`desanotar(nombre, ts, ruta)` corta por **identidad**. Y compara `ruta` con `IS` y
no con `=`, porque `ruta = NULL` nunca es cierto en SQLite: la versión equivocada
devuelve `0` contra una base perfectamente sana y se lee como "la fila ya no
estaba". Hay test de las dos mitades —borra la nula, y `""` no confunde con nula.

**El cero de referencia estaba mal.** La comprobación era
`leido.porEvento.visita < 1`, un absoluto. Con una base que ya tuviera 500 visitas,
`500 < 1` es `false` y el doctor anunciaba `[OK]` con la escritura fallando en
silencio. Ahora mide el **delta** entre antes y después, que es lo único que
distingue "mi fila no entró" de "aquí ya había tráfico".

### Verificado, no supuesto

- `tsc` 0 · **1155/1155** tests · lint 0 errores (16 warnings, baseline) · build 0.
- Contra una base **real**: dos ejecuciones de `doctor` seguidas dejan
  `SELECT COUNT(*)` en **0, 0**. Con el código anterior dejaban 1 y luego 2.
- El mensaje dice ahora `(fila de prueba borrada)`, que antes salía vacío porque
  `podar` devolvía `0` y no estaba borrando nada.
- Base inservible (el directorio es un fichero): sale `[AVISO]`, no `[FALLO]`, así
  que el cron sigue publicando aunque el contador se congele.

## Hecho: el tema tiene tres estados, no dos (2026-10-20)

El botón "Tema del sistema" no hacía nada, y el control **mentía**: decía que
estaba en "sistema" mientras la página estaba en claro.

### Los tres estados, y por qué tres

- `"dark"` / `"light"`: lo que eligió la persona.
- `"auto"`: lo que marque el sistema. **Sin atributo**, que es lo que deja que la
  media query de `globals.css` decida, y con ella el sistema, en vivo.
- **Nada guardado**: el valor por defecto del sitio, que es **claro**.

Lo que rompió esto fue el rehacer de la paleta, que hardcodeó `"light"` en el
script del `<head>`. La decisión de diseño —"light is now the default rather
than following `prefers-color-scheme`"— era correcta y sigue igual; lo que no
tenía sentido es que el script **borrase** la clave al elegir "auto", con lo
que "auto" y "nunca he elegido" pasaban a ser el mismo estado: la elección se
perdía al recargar.

Y el `getSnapshot()` devolvía `"auto"` cuando no había nada guardado, así que
el botón salía pulsado en "Tema del sistema" con la página en claro. **Un
control que dice una cosa y la página hace otra es un fallo aunque la página
esté bien.**

### `removeAttribute` y no `dataset.theme = ""`

El atributo vacío **sigue casando** con `:root:not([data-theme="dark"])`, que
es la regla que aplica la paleta clara cuando el sistema es claro. Con el
atributo vacío, el "auto" se quedaba atado al tema claro para siempre.

### El script se prueba como lo que es: un script

`__tests__/tema-script.test.ts` **ejecuta** el script del `<head>` con un
`document` de mentira y comprueba los tres estados. Un test que leyera el
código y buscara una cadena comprobaría que la cadena está, no que el script
haga lo que dice.

## Hecho: el atajo de buscar tiene un solo dueño (2026-10-20)

`Ctrl+K` / `⌘K` abría **dos** buscadores: el del `Header` y el del hero de la
portada. Los dos escuchaban `window`, los dos anuncian el atajo con su cartel
al lado, y los dos abrían su panel. El foco acababa en el input del que se
había cerrado, o sea en el que no era.

### La regla: manda el último registrado

`lib/search-shortcut.ts` es un registro. El `Header` está en el layout y se
registra antes que el `HeroSearch`, que es más profundo: **el orden de montaje
es el de la jerarquía**, así que en la portada manda la búsqueda grande —la que
la persona tiene delante y la que lleva el cartel al lado— y en el resto de
páginas, que no tienen hero, manda la del `Header`.

El manejador se guarda en un `ref` y se escribe en un efecto, **no en el
render**: si dependiera de la identidad del manejador, un re-render lo quitaría
y lo volvería a añadir al final de la lista, y el orden —que es la regla—
cambiaría sin que nadie lo pidiera. Y un ref no se toca durante el render.

### El cartel del atajo es la promesa

Los dos sitos donde sale el cartel `⌘K` son los dos que **responden** al
atajo. Por eso los dos se apuntan al registro y solo uno atiende la tecla.

## Verificado (2026-10-20)

- `tsc` 0 · **1176/1176** tests · lint 0 errores (16 warnings, baseline) ·
  build 0 · **31/31** e2e.
- El e2e que fallaba no estaba midiendo la app: **cinco tests seguían la home
  anterior** —"Hoy en Gasteiz", "Top 10", `a[aria-label="Plan destacado"]`— que
  se quitaron a propósito. El de la paleta además comparaba con el
  `--bg` antiguo (`#0B0E14`, ahora `#16160F`).
- El atajo se mide **reintentando**: el `keydown` lo escucha un `useEffect` y
  la hidratación no la mide `networkidle`, que mide el red. En desarrollo
  Turbopack compila los módulos del cliente a la primera petición, así que
  pulsar la tecla una vez y comprobar mide la velocidad de la compilación.
- El aviso de cookies **cubre el pie**, y el selector de tema vive en el pie:
  `e2e/helpers.ts` lo cierra antes de pulsar. No es un bug de la app —el aviso
  se cierra con un clic— pero es una condición del entorno de prueba.

## Hecho: el cuadrante de guardia se lee (2026-10-20)

El Colegio Oficial de Farmacéuticos de Álava publica el cuadrante en
`https://cofalava.org/farmacias-de-guardia/`, y **la página lleva el año entero
de la rota dentro**: 5.916 entradas —una por farmacia y día—, de las cuales
2.190 son de Vitoria-Gasteiz. Cada una trae horario, fecha, teléfono, barrio,
zona y si el turno es de día o de noche.

### La belief que era falsa

El repo creía que el Colegio "responde 403 en todo su dominio, con y sin TLS,
con cualquier User-Agent", y por eso servía el **directorio** de
opendata.euskadi.eus: 78 farmacias con dirección y teléfono, **sin turno**.

**El WAF bloquea el User-Agent de navegador, no el dominio.** Medido el 20 de
octubre de 2026 contra el sitio en vivo:

    User-Agent de Chrome  -> 403 (75 KB: la página del WAF)
    okhttp/4.9.3          -> 200 (6,5 MB: el cuadrante)
    sin User-Agent        -> 200 (6,5 MB: el cuadrante)

El 403 era **siempre** con el UA de navegador, que es lo que se prueba primero.
Y el 403 del WAF son 75 KB de HTML: no es un error de red, es una página. La
conclusión "no se puede" salía sola, y era una conclusión sobre el UA.

`okhttp` no es esconderse: el Colegio publica este dato para que se use, y lo
único que no se hace es simular a una persona.

### La web y la app enseñan lo mismo

`/api/farmacias` sirve ahora el **cuadrante** —las guardias del día, con
horario y turno— y no el directorio. La página de la web y la pantalla de la
app móvil leen la misma ruta y los mismos campos, que es lo que se pidió.

El envelope **no se toca**: `source`, `date`, `count`, `fetchedAt` y `data`. Lo
único nuevo dentro de cada farmacia es `guardia` —`diurna`, `nocturna` o
`ambas`—.

Y `date` ahora **sirve para algo**: antes salía vacía siempre porque el
directorio no publica turno, y la página la compara con "hoy" para poner el
cartel de "Actualizado". Con el cuadrante, ese cartel aparece.

### El fallo del escáner que casi se cuela

El array `"places"` de la página se extrae contando corchetes. Si la marca
incluye el `[` del array, el desplazamiento lo salta y el conteo empieza
**dentro** del primer objeto: el `[` no se cuenta, el `}` del primer lugar lo
cierra y el array se corta tras una farmacia.

**Y no da error de sintaxis**: `JSON.parse` recibe un objeto válido —el primer
lugar— y lo devuelve como si fuera el array. 4 de 5.916 entradas, y ningún test
que mirara el número de plazas lo notaría. El test mira las cuatro, y la
última del fixture, precisamente para que un corte por el principio no pueda
pasar inadvertido.

### Verificado (2026-10-20)

- 6 guardias en Vitoria para hoy: 4 de día (09:00-22:00) y 2 de noche
  (22:00-09:00). En la web y en la app, las mismas seis.
- `tsc` 0 · **1182/1182** tests · lint 0 errores · build 0 · **31/31** e2e.
- El doctor: todo correcto salvo la clave de la API, que es lo que tiene que
  arreglarse en el despliegue.

## Hecho: la auditoría de interfaz y de las URLs (2026-10-20)

Un barrido de **las veintiuna páginas** en escritorio y en móvil, y de **las
catorce rutas** que la app móvil consume contra producción. Salieron cinco
cosas, y ninguna daba error rojo.

### `/docs` no enseñaba la API

Swagger pintaba **"No layout defined for StandaloneLayout"** en vez de la
documentación. Eran dos fallos encadenados:

- El preset va en `swagger-ui-standalone-preset.js`, **un bundle aparte**, que
  no se cargaba.
- Y el preset **no es una propiedad del bundle**: su webpack lo deja en
  `window.SwaggerUIStandalonePreset`, y pedirse
  `SwaggerUIBundle.SwaggerUIStandalonePreset` —que es lo que se escribía—
  devuelve `undefined` **siempre**, exista o no el bundle.

La página que documenta el contrato con la app móvil llevaba rota sin que nada
lo dijera.

### El pie rompía la jerarquía de encabezados en casi todas las páginas

Un salto de `h1` a `h3` no da error, no se ve en una captura y solo lo nota
quien navega por encabezados. **Catorce de veintiuna páginas** lo tenían, y la
mayoría por el pie, que usaba `h3` para sus tres columnas.

Las columnas del pie son secciones de primer nivel: ahora son `h2`. Y las
páginas que son **una lista y nada más** —`/bus`, `/buscar`, `/favoritos`,
`/metricas`, `/hoy`, `/movies`, `/culture`, `/kids`, `/turismo`,
`/gastronomia`, `/deporte`— ponen sus tarjetas en `h2`, que es el nivel que les
toca cuando el `h1` de la página es el único encabezado de arriba.

**El nivel de la tarjeta compartida es un parámetro, no una constante**:
`EventCard` y `MovieCard` se usan también en la home, donde cuelgan de un `h2`
de sección y sí son `h3`.

### La clave de la API no era la del despliegue

**Las doce rutas protegidas de producción respondían 401 con la clave del
`.env`.** La app móvil manda esa misma clave —va dentro del APK—, así que en
producción se quedaba **sin eventos y sin decir por qué**.

No se puede arreglar desde el repo: el valor correcto está en el entorno de
Dokploy. Pero sí se puede hacer que **no vuelva a pasar en silencio**, y ahora
`npm run doctor` **prueba** la clave contra el servidor en vez de comprobar que
la variable esté puesta. Es el mismo tratamiento que `MEC_TOKEN`: no se
comprueba que exista, se usa.

### La Blanche era un calendario estacional tratado como avería

`calendariosID=513` solo tiene eventos la semana grande. Medido el 20 de
octubre de 2026: **59 eventos** en el 15jul–12ago de 2026 y **cero** en el de
2027, que es la edición siguiente y todavía no está publicada.

Ese cero es la respuesta correcta, pero la regla de "cero resultados en un
rango que empieza ya es una avería" —escrita para los diecisiete calendarios
municipales, que están vivos todos los días— lo convertía en un error. El
scraper lo devolvía vacío y **La Blanca desaparecía de la agenda sin que nada
lo dijera**: la salud seguía en 37/37 porque la fuente no rechazaba, solo
devolvía lista vacía.

Ahora quien pide el calendario dice si su cero es un avería, y La Blanca dice
que el suyo no lo es.

### Una imagen rota en la cartelera

Florida sirve algunas carátulas con la ruta mal formada —`…/eventos/.jpg`, sin
nombre— y contesta **200 con cero bytes**. El host estaba en la lista, así que
el filtro lo dejaba pasar, y el optimizador lo convertía en un 400: imagen
rota en la pantalla.

La regla general, en `imagenServible`: **una URL sin nombre de archivo no es
una imagen**, por muy permitido que esté su host.

### Verificado (2026-10-20)

- `tsc` 0 · **1184/1184** tests · lint 0 errores (16 warnings, baseline) ·
  build 0 · **31/31** e2e.
- Un barrido de las 21 páginas en dos viewports: **0** errores de consola, **0**
  imágenes rotas, **0** saltos de encabezado, **0** campos sin nombre accesible.
- Las 14 rutas de la app móvil, contra producción **y** contra desarrollo.
- `npm run doctor`: todo correcto salvo la clave de la API, que es lo que tiene
  que arreglarse en el despliegue.


## Hecho: la agenda se puede leer desde la app movil (2026-10-21)

La app movil se quedaba **sin eventos y sin decir por que**: las doce rutas de
la agenda respondian 401 y el resto de secciones tampoco. La causa no era la
app: era que el servidor exigia una clave que **no era la que llevaba la app**.

### El razonamiento que estaba mal

El repo tratava la clave como si protegiera algo. **No protege nada:** una
clave dentro de un APK sale con un `strings`, asi que la unica persona a la
que protege es a la app de la casa, que es justo quien tiene que leer la
agenda. Exigirla era un muro entre el producto y su propio cliente.

Y hay un dato que lo confirma: **la web lo veia todo bien**, porque la web lee
los datos en el servidor y no necesita clave. Los datos estaban; lo que no
funcionaba era el camino.

### Lo que se abrio, y lo que no

**Las doce rutas de la agenda y `/api/v1/events`**, por su nombre exacto, con
su motivo escrito en `lib/api-public-routes.ts`. La coincidencia sigue siendo
exacta: un prefijo abriria lo que se añadiera mañana sin que nadie lo decidiera.

**Lo que escribe sigue cerrado:** `/api/push/send`, `/api/promo/*` y el
`GET` de `/api/metric`.

### El limitador va antes de la exencion

**El limitador del middleware no llegaba a las rutas publicas**, porque
`isPublicApiRoute` devolvia mucho antes de mirarlo. Eso estaba escrito en el
AGENTS.md como una trampa conocida, y era justo lo que impedia abrir la agenda
sin abrirlo de par en par.

Ahora el limitador va **antes** de la exencion, con **60 por minuto** para las
rutas de la agenda y 100 para el resto. El techo es mas bajo a proposito: una
respuesta de agenda son miles de eventos en un JSON, y con el general de 100
treinta peticiones cubren la agenda entera.

Y las rutas publicas **tambien llevan las cabeceras de cache**, que antes
solo llevaban las protegidas: con la agenda abierta, doce de las rutas mas
consultadas se quedaban sin `Cache-Control`.

### El aviso de cada seccion, en su sitio

En la app, una seccion que fallaba **desaparecia**: los dos carruseles
devuelven `null` cuando no tienen datos, y "no hay datos" y "no se pudo
preguntar" se veian igual. Ahora cada seccion pinta su propio aviso, con el
nombre de la seccion, el codigo del error y un boton de reintentar.

### La clave del `.env` de la app

En `babel.config.js`, `path: (process.env.ENVFILE || '.env').trim()`.

**El `.trim()` no es cosmetria.** En `cmd`, `set ENVFILE=.env.test && npx …`
deja un **espacio al final** del valor: la variable vale `".env.test "`, con el
espacio dentro. El plugin abria un fichero que no existe, el entorno salia
vacio y `GasteizClick_API_URL` quedaba `undefined` —que es exactamente lo
que `infrastructure/api.ts` describe: la app **no trae datos y no da error**,
y en realidad estaba hablando con produccion.

Un espacio invisible decide a que servidor apunta la app.

### Verificado (2026-10-21)

- `tsc` 0 · **1191/1191** tests · lint 0 errores · **1191/1191** en la suite de
  la web.
- Las quince rutas que consume la app, sin clave, contra el servidor de
  desarrollo: **todas 200 y con datos**.
- **En un movil fisico**: la home enseña La Blanca, Proximos Eventos, Cartelera,
  Cultura, Deporte, Ninos, Tardeo y Tours, con imagen. Sin ningun 401.
- El aviso de claves repetidas de React: **0**. Venia de la seccion de
  Cultura, que lee una ruta que devuelve los eventos del calendario municipal
  **en crudo**, sin `id` ni `slug`; y una exposicion son cinco entradas con la
  misma pagina y fechas distintas. Con el enlace y la fecha, la clave es
  unica; y las ocho filas que el calendario devuelve **exactamente duplicadas**
  se quitan.

## Hecho: la marca es la misma en la app y en la web (2026-10-21)

El logo de la app era **un rectangulo negro** —`img/logotop.png`, que no usaba
nadie— y el icono del lanzador era **otro logo entero**, el rojo de "GASTEIZ
CLICK" de antes del rebrand. Dos marcas distintas para la misma app, y ninguna
con relacion con la de la web.

### Un solo dueno, y es este repositorio

`public/brand-mark.svg`, `public/icon-512.svg`, `public/icon-maskable.svg` y
`public/logo-reducido.svg` son el original. `scripts/generate-app-brand.mjs`
saca de ahi los PNG de la app y los iconos del lanzador de Android.

**La app no puede importar un componente de React**, y el icono del lanzador
tiene que ser un raster de todas formas: el sistema lo recorta con su propia
mascara y no lee vectores. Si el PNG se dibujara a mano, el logo de la app y el
de la web serian dos marcas que se separan sin que nada lo diga.

El primer plano del icono adaptativo es **la marca sola, sin fondo**, con el
fondo en su propia capa: si el fondo fuese parte del primer plano, se veria el
recorte del sistema —un cuadrado crema dentro de otro cuadrado crema—. Y la
marca se recentra, porque su caja no lo esta: llega mas a la derecha que a la
izquierda, y sin corregirlo el icono se ve desplazado dentro de su mascara.

### La variante reducida tambien es un fichero

La cabecera de la web usa `LogoMarkReducido` —la G, el pincho y la txapela—,
que a 24 px es lo unico que se lee de la marca completa. Esa variante vivia
solo dentro de un componente JSX, con `currentColor` y la variable de acento:
el navegador puede heredar el tema, el sistema operativo no. Ahora hay tambien
`public/logo-reducido.svg`, con los colores escritos, y
`__tests__/logo-marca.test.ts` comprueba que los dos digan lo mismo.

### Las cards sin imagen llevan la marca

Las seis tarjetas de la app ponian un icono generico de "no hay foto"
descargado de un CDN. Ahora ponen **la marca**, y en un solo sitio:
`infrastructure/brand.ts`, con `fuenteDe()`.

**Con fondo crema y no transparente a proposito:** es la imagen de una tarjeta
que no tiene foto, y en el tema oscuro la txapela —que es negra—
desapareceria sobre el fondo de la tarjeta. Con el crema de la marca detras, se
lee igual en los dos temas y ademas se sabe de quien es la tarjeta.

### La paleta de la app no es la de la web

**Queda pendiente, y es una decision, no un bug.** La app usa
`primary: #BC0202` y `accent: #E23B45`; la marca y Stitch usan
`#dc2626` y `#b70011`, y la crema de la marca es `#faf9f5`. El logo ya lleva
el rojo de Stitch, asi que **hoy conviven dos rojos**. No se ha tocado la
paleta porque cambiar el acento de la app entera es una decision de diseno, no
un arreglo.

## Hecho: la app y la web cuentan lo mismo (2026-10-21)

### Lo que la app no podia calcular

**"Recomendados" es del servidor, y no se puede hacer de otra forma.** El
criterio -que eventos cuentan, con que peso y como se funden los que varias
fuentes publicaron- vive en `lib/recomendados.ts`, y es el mismo que usan la
portada, `/hoy` y el post de Instagram.

La app tiene su propio criterio por categoria, y con el mismo criterio la home
de la app y la de la web dirian dos cosas distintas sobre el mismo dia, que es
justo lo que `lib/recomendados.ts` documenta que no debe pasar.

**`/api/v1/recomendados`** es la puerta: lee el agregado, aplica
`recomendados()` con el dia de hoy y devuelve diez eventos con su `ranking`.
Es publica por lo mismo que las otras doce de la agenda: una app movil no
puede guardar un secreto.

### Lo que si se puede calcular en la app

**"Hoy en Vitoria"** no necesita servidor: el agregado ya trae la fecha de
cada evento, y el filtro por el dia de hoy es el mismo que hace `/hoy`. Va en
la app, en el hook, con `esHoy()` de `infrastructure/fechas.ts`.

### El endpoint que no existia

Se preguntaba por un endpoint de la agenda. Los que hay son:

| Ruta | Que devuelve |
| --- | --- |
| `/api/v1/events` | El agregado, con paginacion. La paginacion de la app |
| `/api/v1/recomendados` | Los diez recomendados de hoy |
| `/api/v1/salud` | Si el agregado que se esta sirviendo esta completo |
| `/api/actividades/eventos/proximos` | Todos los eventos futuros, sin paginar |
| `/api/actividades/eventos/agenda` | La agenda del calendario municipal, **en crudo** |

**El ultimo es el que confunde:** devuelve los eventos del calendario municipal
sin el `id` ni el `slug` que el agregador les pone, y con enlaces que se
repiten —una exposicion son cinco entradas con la misma pagina y fechas
distintas—. Por eso la app necesita una clave que sea unica.

### Y el bus, que tenia dos errores de nombres

La app leia `item.rutas` y la API devuelve `item.lineas`: los badges de color
de las paradas estaban pintados, con su estilo y todo, pero de una lista que no
existe. **No se veia ni una linea y no habia ningun error.**

Y las llegadas leian `realtimeArrival` y `scheduledArrival`, que no existen
en los datos del proxy —que traen `seconds`, los que faltan—, asi que todas
salian a "00:00" y "A tiempo". Ademas la pantalla llamaba al tercero
directamente, saltandose el proxy de la web y su cache.

### Las rutas del bus, en crudo

Las que devuelve el proxy y la app consume:

| Accion | Devuelve |
| --- | --- |
| `?accion=cerca&lat=&lng=&radio=` | Las paradas cercanas, con sus lineas |
| `?accion=detalle&idParada=` | La parada, sus lineas con color, las llegadas y las alertas |
| `?accion=buscar&buscar=` | Paradas por nombre |
| `?accion=alertas` | Las alertas globales |

**`detalle` y no `parada`:** la accion se llama como se llama, y "parada" da
"Acción desconocida".

