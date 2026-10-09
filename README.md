# Gasteiz Click

Agenda cultural de Vitoria-Gasteiz. API REST + web frontend (Next.js 16).

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
`/api/promo/presentacion`. Todas son públicas a propósito, porque el correo las baja sin
credencial.

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

Todo lo demás —`/api/actividades/*`, `/api/v1/events`, `/api/fever`, `/api/rula`,
`/api/push/send`— pide `x-api-key` o `?api_key=`.

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
