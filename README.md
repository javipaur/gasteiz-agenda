# Gasteiz Click

Agenda cultural de Vitoria-Gasteiz. API REST + web frontend (Next.js 16).

**[Web](https://gasteizclick.javierpalacio.es)** · **[Google Play](https://play.google.com/store/apps/details?id=com.javipaurdev.gasteizclick)**

## Qué es

La ciudad ya tenía agenda, pero repartida en **más de 15 fuentes sin cruce**. Aquí se
agrega, se normaliza, se deduplica y se publica en una PWA, en un feed RSS y en
una API REST. Se actualiza cada pocos minutos.

Más allá del listado:

- **PWA instalable**, con app Android en Google Play y guía de instalación
  específica para iOS, que no dispara `beforeinstallprompt`.
- **Push notifications** (Web Push / VAPID) y **newsletter** semanal por correo.
- **API REST** con `x-api-key` y OpenAPI publicado. El middleware comparte una
  única lista de rutas públicas con el test que la verifica, así que la lista no
  puede desincronizarse de la realidad.
- **Búsqueda, favoritos, fichas por evento**, sitemap y OG images dinámicas.

## Stack

Next.js 16 (App Router, RSC) · React 19 · TypeScript estricto · Tailwind v4 ·
Jest · Playwright · PWA · OpenAPI

## Testing

**1.112 tests** entre unitarios y de componente (Jest) y 7 specs e2e
(Playwright), con `tsc` y `lint` en verde.

Dos partes que no son el testing de siempre:

- **Accesibilidad como test.** `__tests__/helpers-a11y.ts` monta componentes en
  jsdom y asserta el árbol: `aria-label` presente y, sobre todo, que **no haya un
  interactivo dentro de otro**, que es HTML inválido y no un detalle de estilo.
- **El baseline de lint es un test.** `__tests__/lint-baseline.test.ts` ejecuta
  ESLint de verdad contra la lista de exentos de `lib/lint-baseline.json`.
  Contar errores no sirve —arreglar un `any` y añadir otro se cancelan y el rojo
  no aparece nunca—, así que lo que se vigila es la **lista de ficheros**.

## Desarrollo local

```bash
npm install
npm run dev
```

http://localhost:3000

## Build

```bash
npm run build
npm start
```

## Despliegue (Dokploy)

El proyecto se despliega automáticamente vía Dokploy al hacer push a `main`. La config de Dokploy usa `nixpacks.toml` (Node.js 22).

### Variables de entorno requeridas

Configurar en Dokploy o en `.env.local`:

| Variable | Descripción |
|---|---|
| `API_KEY` | Clave para autenticar endpoints `/api/*`. **Sin ella las rutas protegidas responden 503**: el middleware cierra en vez de abrir |
| `CORS_ORIGIN` | Origen permitido para las rutas de `/api/*` que piden `API_KEY`. Sin ella, esas rutas no llevan `Access-Control-Allow-Origin` |
| `SUBSCRIBERS_PATH` | Ruta del fichero de suscriptores. Por defecto `data/subscribers.json`. Apúntala al volumen persistente |
| `AXIOM_TOKEN` | Token de ingestión de Axiom (opcional) |
| `AXIOM_DATASET` | Dataset de Axiom |
| `VAPID_PUBLIC_KEY` | Clave pública VAPID para push notifications |
| `VAPID_PRIVATE_KEY` | Clave privada VAPID |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Misma clave pública VAPID (client-side) |
| `ENABLE_PUSH_SCHEDULER` | `1` para habilitar el scheduler de push |
| `PUSH_DIGEST_HOUR` | Hora del digest diario (formato 24h) |
| `EMAIL_USER` | Cuenta SMTP Gmail que envía el newsletter. **Obligatoria en producción** |
| `EMAIL_PASS` | Contraseña de aplicación de Gmail. **Obligatoria en producción** |
| `PROMO_PARA` | Destinatario del carrusel del día o del finde. Sin ella el cron escribe los ficheros y sale con 1 |
| `NEXT_PUBLIC_SITE_URL` | URL base del sitio (newsletter, RSS, enlaces) |
| `MEC_TOKEN` | Token del API de La Genterula. **Sin ella la fuente no se consulta** y sus eventos no salen en la agenda |
| `NEXT_PUBLIC_ANALYTICS_URL` | Opcional. Sin ella `Analytics` devuelve `null` y **no hay forma de medir qué post de Instagram trajo visitas** |

### El carrusel del día y del finde, por correo

```bash
npm run promo:send
```

Corre **todos los días** por cron y solo hace algo tres: jueves, viernes y sábado. El
resto sale con código 0 sin mandar nada, que es lo que permite un único cron en vez de
tres tareas que se desincronizan.

El sábado manda el fin de semana entero; el jueves y el viernes, ese día. Cuando llega,
el correo lleva las imágenes numeradas **en línea y también adjuntas**, el texto del pie
para copiar y pegar, y el enlace con la utm de la fecha.

**No publica.** No hay token de Instagram ni llamada a la Graph API en ninguna parte del
proyecto, y la publicación es manual: quien recibe el correo decide si el día lo merece.
Lo que se automatiza es la preparación, que es lo caro.

Dos cosas pueden pararlo, y ninguna es un error de configuración:

- **El agregado está degradado.** Si alguna fuente falló, no manda nada **y no escribe
  ficheros**. Comparar el día con los anteriores no serviría: el agregado no guarda
  eventos pasados, así que la comparación no tendría línea base.
- **El día viene flojo.** Con menos de tres planes escribe los ficheros en disco y no
  manda correo, para que quien lo quiera pueda mandarlo a mano.

Sin `PROMO_PARA` pasa lo mismo: ficheros en disco, código de salida 1.

Las imágenes del finde las genera el sitio en `/api/promo/<fecha>/portada` y
`/api/promo/<fecha>/evento/<slug>`; la del post de presentación, en
`/api/promo/presentacion`; y la vertical de historia, en `/api/promo/<fecha>/historia`.
Todas son públicas a propósito, porque el correo las baja sin credencial.

### Comprobar que todo está en su sitio

```bash
npm run doctor
```

Una pasada de un minuto por todo lo que el paquete necesita: las cuatro rutas de imagen
**leyendo el cuerpo y comprobando la firma del PNG**, el paquete que baja el correo, el
agregado, las variables del correo, que `tsx` y `dotenv` estén declaradas y que el modelo
del casting responda. **Sale con código 1 si algo falla**, que es lo que lo hace usable
desde el cron sin que nadie tenga que leer la salida.

Existe porque tres cosas se rompieron sin que nada lo dijera. Las rutas de imágenes
devolvían 502 desde octubre —Satori corta la respuesta a mitad del stream y el cliente solo
ve un error sin cuerpo—, el script se paraba en la puerta de salud con 36/37 porque no
cargaba el `.env`, y `tsx` no estaba en `package.json`. Ninguno daba error visible, y los
tests no los cazaban porque solo miraban las cabeceras.

**`MEC_TOKEN` se prueba contra la API y no se comprueba por estar presente.** Con un token
caducado, `scrapeRula` devuelve `[]` en vez de fallar, así que la variable está puesta, la
salud sigue en 37/37 y el token no sirve. Es el único modo de fallo de esta lista que no se
ve solo.

Sin `EMAIL_USER`/`EMAIL_PASS` el envío de correo **falla de forma explícita** en
producción (`scripts/send-newsletter.ts` y `scripts/enviar-promo.ts` salen con código 1).
Fuera de producción se registra en consola y no se envía nada, para poder desarrollar sin
credenciales.

Sin `MEC_TOKEN` pasa lo mismo con La Genterula: `scrapeRula` avisa por consola y
devuelve lista vacía, y el resto de la agenda sigue saliendo. Es deliberado, para
que rotar el token sea cambiar una variable y no editar código.

### Cómo se envía el newsletter

**No hay ninguna ruta que lo dispare.** El newsletter se manda con un cron, y es
deliberado:

```bash
npm run newsletter:send
```

Se configura en Dokploy como tarea programada (sugerencia: una vez por semana).
El script obtiene los eventos del agregador, se los pasa a cada suscriptor activo
y **sale con código 1 si algo falla**, para que el cron no lo tome por bueno.

No depende de HTTP ni de `API_KEY`: un script del repo no debería depender de que
su propio despliegue le deje pasar. Por eso no existe `/api/cron/send-newsletter`
—que además sería un endpoint capaz de mandar correo a todos los suscriptores— y
por eso el push sí tiene una ruta (`/api/push/send`) pero el correo no: al correo
no se le puede reintentar solo a los que no salieron.

Sin `EMAIL_USER`/`EMAIL_PASS` el script **falla** en producción en vez de fingir
que ha enviado. Es a propósito: una newsletter a medias no tiene forma de
reanudarse.

## API: qué es público y qué no

Las rutas que responden **sin** `API_KEY` están en una única constante,
`lib/api-public-routes.ts`, y la comparten tres sitios: el middleware, la CORS de
`next.config.ts` y el test que contrasta `public/openapi.yaml` contra ella. La
coincidencia es exacta: no hay prefijos, así que añadir una ruta es escribir su
nombre.

| Ruta | Por qué es pública |
|---|---|
| `/api/farmacias`, `/api/search`, `/api/vgbus`, `/api/push/subscribe` | Las llama el navegador desde un componente cliente, que no tiene la clave |
| `/api/newsletter/subscribe`, `/api/newsletter/confirm`, `/api/newsletter/unsubscribe` | El alta es un formulario y los otros dos son enlaces que llegan por correo |
| `/api/cines`, `/api/cines/boulevard`, `/api/cines/florida` | Se publican en el OpenAPI para clientes móviles |
| `/api/actividades/*` (doce rutas) y `/api/v1/events` | **La app móvil las lee y no puede guardar un secreto** |

### La agenda es pública porque la app móvil no puede guardar una clave

Una clave dentro de un APK sale con un `strings`, así que exigirla no protege
nada: solo impide que la app de la casa, que es quien tiene que leer la
agenda, pueda hacerlo. Y eso es exactamente lo que pasaba: **la app recibía
401 en las doce rutas y se quedaba sin eventos**, mientras la web —que lee los
datos en el servidor y no necesita clave— lo veía todo bien.

Lo que queda protegido es lo que de verdad tiene que protegerse: lo que
**escribe**. `/api/push/send`, `/api/promo/*` y `/api/metric` (su `GET`) siguen
pidiendo clave.

> **Y abrir la agenda no es abrirlo de par en par.** El limitador del
> middleware va **antes** de la exención de clave, con un techo de **60 por
> minuto** para estas rutas y 100 para el resto. Antes el limitador no llegaba
> a las rutas públicas, porque `isPublicApiRoute` devolvía mucho antes.

Todo lo demás —`/api/fever`, `/api/rula`, `/api/push/send`, `/api/actividades`
a secas y las subrutas que no salen en la lista— pide `x-api-key` o
`?api_key=`.

> Antes de desplegar, comprueba que Dokploy tiene un volumen persistente montado.
> `lib/db.ts` (suscriptores) y `.data/push.db` (push) escriben en disco; sin
> volumen, ambos se pierden en cada redeploy. Apunta `SUBSCRIBERS_PATH` a la
> misma montura que `.data/`.

## Estructura

```
app/
  api/          ← endpoints REST
  components/   ← componentes React
  services/     ← scrapers externos (boulevard)
lib/
  sources/      ← scrapers de fuentes de datos
  cache.ts      ← caché en disco (tmp)
  eventos.ts    ← normalización y deduplicación
```

## Testing

```bash
npm test              # Jest unit tests
npm run test:e2e      # Playwright E2E
```
