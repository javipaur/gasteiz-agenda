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
| `API_KEY` | Clave para autenticar endpoints `/api/*` |
| `AXIOM_TOKEN` | Token de ingestión de Axiom (opcional) |
| `AXIOM_DATASET` | Dataset de Axiom |
| `VAPID_PUBLIC_KEY` | Clave pública VAPID para push notifications |
| `VAPID_PRIVATE_KEY` | Clave privada VAPID |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Misma clave pública VAPID (client-side) |
| `ENABLE_PUSH_SCHEDULER` | `1` para habilitar el scheduler de push |
| `PUSH_DIGEST_HOUR` | Hora del digest diario (formato 24h) |
| `EMAIL_USER` | Cuenta SMTP Gmail que envía el newsletter. **Obligatoria en producción** |
| `EMAIL_PASS` | Contraseña de aplicación de Gmail. **Obligatoria en producción** |
| `NEXT_PUBLIC_SITE_URL` | URL base del sitio (newsletter, RSS, enlaces) |

Sin `EMAIL_USER`/`EMAIL_PASS` el envío de correo **falla de forma explícita** en
producción (`scripts/send-newsletter.ts` sale con código 1). Fuera de producción
se registra en consola y no se envía nada, para poder desarrollar sin credenciales.

> Antes de desplegar, comprueba que Dokploy tiene un volumen persistente montado.
> `lib/db.ts` (suscriptores) y `.data/push.db` (push) escriben en disco; sin
> volumen, ambos se pierden en cada redeploy.

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
