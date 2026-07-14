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
    <main style={{ minHeight: "100vh", background: "#fafafa" }}>
      <div
        id="swagger-ui"
        style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem 1rem" }}
      />
    </main>
  );
}
