"use client";

import { useEffect } from "react";

export default function ApiDocsPage() {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js";
    script.onload = () => {
      // @ts-expect-error SwaggerUIBundle is loaded via CDN
      window.SwaggerUIBundle({
        url: "/openapi.yaml",
        dom_id: "#swagger-ui",
        presets: [
          // @ts-expect-error SwaggerUIBundle is loaded via CDN
          window.SwaggerUIBundle.presets.apis,
          // @ts-expect-error SwaggerUIBundle is loaded via CDN
          window.SwaggerUIBundle.SwaggerUIStandalonePreset,
        ],
        layout: "StandaloneLayout",
        deepLinking: true,
        defaultModelsExpandDepth: -1,
        docExpansion: "list",
        filter: true,
      });
    };
    document.body.appendChild(script);
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
      <div
        id="swagger-ui"
        style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem 1rem" }}
      />
    </div>
  );
}
