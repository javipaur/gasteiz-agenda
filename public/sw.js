const CACHE_NAME = "gasteiz-click-v2";
const STATIC_CACHE = "gasteiz-static-v2";
const DYNAMIC_CACHE = "gasteiz-dynamic-v2";

/**
 * Si esto se está sirviendo desde una máquina de desarrollo.
 *
 * Y la razón de existir: el `fetch` de más abajo sirve `/_next/static/`
 * **cache-first**, lo cual está bien en producción —los chunks llevan el hash
 * del contenido en el nombre, así que una URL es siempre el mismo contenido— y
 * está **muy mal en desarrollo**, donde Turbopack usa nombres estables y la
 * misma URL puede servir código distinto según el momento.
 *
 * Con el service worker vivo, el navegador se queda con el primer bundle que vio
 * y sirve ese para siempre. El síntoma parece un HMR roto: se cambia un
 * componente, se recarga, y sale la versión anterior. Y como los chunks tienen
 * nombres distintos, **unos se ven viejos y otros nuevos**, que es la forma más
 * confusa posible de perder el tiempo.
 *
 * `app/components/ServiceWorkerRegistration.tsx` ya no registra el service
 * worker en desarrollo. Esto es la red de seguridad para el que **ya** lo tenía
 * instalado: al activarse en una máquina de desarrollo, se desregistra y borra
 * las cachés, y a partir de ahí el navegador vuelve a hacer lo que le mandan.
 *
 * Elheurístico es el hostname, y el coste de equivocarse es bajo: si alguien
 * levanta la build de producción en `localhost`, pierde el modo offline. Eso es
 * mucho más barato que un bundle viejo servido sin avisar.
 */
const ES_DESARROLLO = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(
  self.location.hostname
);

const STATIC_ASSETS = [
  "/",
  "/offline",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  /*
   * En desarrollo, este service worker **se borra a sí mismo**.
   *
   * Es la red de seguridad para el service worker que ya estaba instalado de
   * antes: se desregistra y limpia las cachés, y el navegador vuelve a pedir
   * los chunks a la red. La razón está en `ES_DESARROLLO`, más arriba: en
   * desarrollo el nombre del chunk no lleva el hash del contenido, y servirlo
   * cache-first es servir un bundle viejo sin avisar.
   */
  if (ES_DESARROLLO) {
    event.waitUntil(
      (async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
        await self.registration.unregister();
      })()
    );
    return;
  }

  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
            return caches.match("/offline");
          }
          return new Response("Offline", { status: 503 });
        });
      })
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = {
      title: "Gasteiz Click",
      body: event.data.text(),
    };
  }

  const options = {
    body: data.body || "Nuevo evento en Vitoria-Gasteiz",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [100, 50, 100],
    data: { url: data.url || "/" },
    actions: [
      { action: "open", title: "Ver evento" },
      { action: "dismiss", title: "Cerrar" },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "Gasteiz Click", options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
