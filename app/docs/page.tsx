"use client";

import { useEffect, useState } from "react";

/**
 * Los dos bundles de Swagger, y el orden.
 *
 * **`swagger-ui-standalone-preset.js` es un fichero aparte y hace falta.**
 *
 * `swagger-ui-bundle.js` trae los layouts de Swagger, pero el que se quiere —
 * `StandaloneLayout`— lo aporta el **preset**, que va en otro bundle. Sin él,
 * `SwaggerUIBundle.SwaggerUIStandalonePreset` es `undefined`, Swagger no
 * encuentra el layout que le han pedido y se queda con un error en pantalla:
 *
 *     No layout defined for "StandaloneLayout"
 *
 * Medido el 20 de octubre de 2026: `/docs` **no enseñaba la API**, sino ese
 * error y nada más. Es la página que documenta el contrato con la app móvil,
 * y llevaba rota desde que se puso el preset.
 *
 * **El orden importa**: el preset se apoya en `swagger-ui-bundle.js`, así que
 * se cargan **uno detrás de otro** y no en paralelo. Con `Promise.all` el
 * preset puede llegar antes que el bundle del que depende.
 *
 * Y si el CDN no contesta, se dice en la página en vez de dejar un hueco en
 * blanco: el enlace al `openapi.yaml` crudo sigue funcionando.
 */
const CDN = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5";

export default function ApiDocsPage() {
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `${CDN}/swagger-ui.css`;
    document.head.appendChild(link);

    /** Carga un script y espera a que termine. Un fallo también resuelve. */
    const cargar = (nombre: string) =>
      new Promise<void>((resolve) => {
        const script = document.createElement("script");
        script.src = `${CDN}/${nombre}`;
        script.onload = () => resolve();
        // Si el CDN no contesta, no se puede esperar para siempre: se sigue y
        // se avisa en la página.
        script.onerror = () => resolve();
        document.body.appendChild(script);
      });

    const montar = () => {
      const ventana = window as unknown as {
        SwaggerUIBundle?: {
          presets?: { apis?: unknown };
          (opciones: Record<string, unknown>): void;
        };
        SwaggerUIStandalonePreset?: unknown;
      };

      const swagger = ventana.SwaggerUIBundle;

      // **El preset es un global aparte, no una propiedad del bundle.**
      //
      // `swagger-ui-standalone-preset.js` asigna `window.SwaggerUIStandalonePreset`
      // —su webpack lo deja en `t.SwaggerUIStandalonePreset`, siendo `t` la
      // ventana—. Antes se pedía `SwaggerUIBundle.SwaggerUIStandalonePreset`, que
      // **nunca existió**: por eso Swagger no encontraba el layout y pintaba su
      // error en vez de la documentación.
      if (!swagger || !ventana.SwaggerUIStandalonePreset) {
        setFallo(true);
        return;
      }

      swagger({
        url: "/openapi.yaml",
        dom_id: "#swagger-ui",
        presets: [swagger.presets?.apis, ventana.SwaggerUIStandalonePreset],
        layout: "StandaloneLayout",
        deepLinking: true,
        defaultModelsExpandDepth: -1,
        docExpansion: "list",
        filter: true,
      });
    };

    cargar("swagger-ui-bundle.js")
      .then(() => cargar("swagger-ui-standalone-preset.js"))
      .then(montar);
  }, []);

  return (
    // Un `<div>`, no un `<main>`: `app/layout.tsx` ya envuelve la página en
    // `<main id="main-content">`, así que abrir otro aquí dejaba dos landmarks
    // `main` en el documento —y el enlace "Saltar al contenido principal" del
    // layout seguía apuntando al de fuera, que ya no era el único.
    //
    // `100dvh` y no `100vh`: en móvil, `vh` es el alto del viewport con la barra
    // de URL desplegada. Al desplazarse la barra se retira, el viewport crece y
    // debajo del panel queda un hueco del color del fondo. `dvh` sigue a la
    // barra, y es lo que ya usan `layout.tsx`, `error.tsx` y `not-found.tsx`.
    <div style={{ minHeight: "100dvh", background: "#fafafa" }}>
      {fallo && (
        <div
          role="alert"
          className="max-w-2xl mx-auto px-6 py-16 text-center"
          style={{ color: "#161616" }}
        >
          <h1 className="text-2xl font-semibold mb-3">
            No se ha podido cargar la documentación
          </h1>
          <p className="mb-4">
            Swagger se descarga de un CDN y ese CDN no ha contestado. El
            documento de la API está disponible igualmente:
          </p>
          <a href="/openapi.yaml" className="underline">
            /openapi.yaml
          </a>
        </div>
      )}
      <div
        id="swagger-ui"
        style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem 1rem" }}
      />
    </div>
  );
}
