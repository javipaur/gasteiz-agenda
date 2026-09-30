# Gasteiz Click — Plan Fase 0 + Fase 1 (aprobado, pendiente de salir de plan mode)

## Aprobado por el usuario
- Mascota **al lado del logo** (no dentro del sello).
- Identidad final: **hueso `#F3EBD4` / negro `#000000` / rojo `#D02D28`** (descarta navy/violeta→ámbar).
- Luz verde para **Fase 0 + Fase 1**.
- Contacto público del proyecto: **javipaur@gmail.com** (bio de IG, feedback del /sobre, WhatsApp) — se usa la cuenta Gmail existente (primera opción descartada: crear hola.gasteizclick@gmail.com).

## Spec real del logo (analizado por píxeles + OCR)
- Lockup horizontal: mark izquierda (sello circular negro + cinta/espiral roja) + "**GASTEIZ**" en negro + "**CLICK**" en rojo + subtítulo "**AGENDA CULTURAL & OCIO · VITORIA-GASTEIZ**" en negro.
- Avatar 1:1: el mismo sello solo, recortado circular sobre crema.
- Fuente: `c:\Users\javie\Downloads\horizontal_brand_logo_lockup_*.png` y `official_social_media_avatar_*.png` (idénticas a las del zip, MD5 verificado).
- El rojo es ~mitad de la marca (mark + "CLICK") y coincide casi exactamente con el rojo actual de la web → armonía barata.

## Fase 0 — Desbloquear build (bloqueante)
1. Crear `app/components/InstallButton.tsx` (`"use client"`): usa `useInstallPrompt` + `promptInstall` de `lib/useInstallPrompt.ts`; icono propio (DownloadIcon); mismo estilo que el botón del footer: `bg-white/5 hover:bg-white/10 ... px-4 py-3 rounded-xl text-sm text-white/70`; si no disponible → `null`.
2. Arreglar `app/components/Footer.tsx`:
   - Borrar interfaz `BeforeInstallPromptEvent`, el `useState`/`useEffect`/`handleInstall` no importados, y `DownloadIcon` local (se muda al botón).
   - Reemplazar `{deferredPrompt && (<button ...>)}` por `<InstallButton />`.
   - Conservar `PlayStoreIcon`, `ThemeToggle`, links y marca "Gasteiz Click".
3. Verificar `npm run build`.

## Fase 1 — Correos reales vía Gmail SMTP
1. Instalar `nodemailer` + `@types/nodemailer`.
2. Crear `lib/mail.ts`:
   - `getTransporter()` lazy (sin exponer secretos): `smtp.gmail.com:465`, `secure:true`, auth `EMAIL_USER`/`EMAIL_PASS`; si no hay credenciales → `null`.
   - `sendMail({to, subject, html, text?}) -> {ok, mock?, error?}`; sin credenciales → log + `{ok:true, mock:true}`; `from` = `Gasteiz Click <EMAIL_USER>` (Gmail no deja suplantar).
3. Refactor `lib/email.ts`: conserva los builders HTML (`buildWeeklyHtml`, `sendWeeklyNewsletter`, `sendConfirmationEmail`); `sendEmail()` pasa a delegar en `sendMail` de `./mail`; quitar `RESEND_API_KEY`/`FROM_EMAIL`.
4. Consumidores (sin cambios en su API): `app/api/newsletter/subscribe/route.ts` (confirmación) y `scripts/send-newsletter.ts` (semanal).
5. `.env` (gitignored): añadir `EMAIL_USER="javipaur@gmail.com"` y `EMAIL_PASS="<app password>"` (NO commitear; recomendar rotar la app password expuesta en el chat).
6. Prueba de envío real: script temporal en `%TEMP%\opencode` que carga `.env` y llama a `sendMail` hacia javipaur@gmail.com.
7. `npm run build`, `npm run lint`, tests.

## Instagram (@gasteizclick) — configuración decidida (se monta en Fase 5)
Decidida tras analizar los perfiles de referencia `huesca.city` (Huesca City App) y `likehuesca` (Like Huesca) en vivo (read-only, sin login). Patrón replicado: nombre descriptivo, bio corta con emojis de separador + hashtag de ciudad + acción, destacados como navegación temática, Reels como formato dominante y reposts cruzados con perfiles locales.

- **Nombre** (campo name, buscable): `Gasteiz Click · Agenda de Vitoria-Gasteiz`.
- **Avatar**: PNG del sello (`official_social_media_avatar_*.png`, idéntico al del zip), recorte circular sobre crema.
- **Tipo de cuenta**: **Creador** (métricas + insights de Reels sin página de Facebook; se puede subir a Negocio después).
- **Bio** (elegida B, estilo likehuesca, <150 caracteres):
  `🧡 Cultura, ocio y mucha calle 🩷 100% made in #VitoriaGasteiz ✉️ javipaur@gmail.com`
- **Destacados**: `Agenda`, `🗓️ Mes`, `Gastro`, `Empleo`, `Colabora` (espejo del /sobre), `Info ℹ️`.
- **Links en bio**: varios (función "links" de IG): web cuando se despliegue + email `javipaur@gmail.com`.
- **Cadencia**: reel diario del pipeline (Remotion + edge-tts + mascota) + 1-2 posts estáticos/semana + reposts de festivales, salas y colectivos locales.
- **Dependencia externa**: la URL final del deploy (para el link en bio y para centralizarla en `lib/social.ts`).

## Pendiente tras Fases 0-1
Fase 2 (SVG del logo + iconos/OG/Header/Footer + tokens), Fase 3 (landing /suscribete), Fase 4 (/sobre + /api/feedback → javipaur@gmail.com), Fase 5 (Reels Remotion + edge-tts + mascota al lado del logo) y montar la config de Instagram del bloque superior.