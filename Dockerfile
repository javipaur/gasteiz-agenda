# La imagen que usan los dos contenedores: la web y el cron.
#
# **Se construye con las devDependencies porque `scripts/enviar-promo.ts` se ejecuta con
# `tsx` y usa el código fuente con su alias `@/`.** No lee nada de `.next`, así que el
# contenedor del cron no necesita el build de Next —pero sí necesita TypeScript para
# resolver ese alias, y las devDependencies son las que lo traen. Instalar con
# `--omit=dev` aquí haría que el cron fallara con un error de módulo que no aparece hasta
# las nueve de la mañana.
#
# **El `ENV NODE_OPTIONS` es del proyecto, no de esta imagen.** Viene en `nixpacks.toml`
# y hace falta para `node:sqlite`, que es experimental: sin él, `lib/db.ts` no arranca.
# Va aquí porque el contenedor del cron también importa esa cadena.
FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    TZ=Europe/Madrid \
    NODE_OPTIONS=--experimental-sqlite

WORKDIR /app

# Las dependencias van en su capa propia y antes que el código, para que un cambio en una
# fuente no reinstale 700 paquetes. Se copian los dos ficheros porque `npm ci` necesita el
# lock y sin él instala otra cosa.
COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .

# **Sin build de Next a propósito.** `next build` tarda minutos, descarga fuentes y avisa
# de `Dynamic server usage` que aquí son warnings. El cron no lo necesita —ejecuta el
# script contra el código fuente— y la web la construye Dokploy por su cuenta con
# nixpacks cuando hace falta. Esta imagen existe para el cron y para tener un sitio donde
# probar los scripts, no para servir la web.
#
# Y por eso **el contenedor del cron no expone ningún puerto**: no sirve nada, solo ejecuta.

# `tsx`, no `node`: el script es TypeScript con alias de ruta, que Node no resuelve.
CMD ["npx", "tsx", "scripts/enviar-promo.ts"]