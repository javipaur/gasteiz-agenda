import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // `/docs` y no `/docs/`: la comparación de `robots.txt` es por prefijo y
        // la barra final es parte del prefijo, así que `Disallow: /docs/` deja
        // pasar justo la URL que existe, `/docs`. Sin barra también cubre lo que
        // cuelgue de ella. Y esto es sólo una pista: la página declara además
        // `robots: { index: false }` en `app/docs/layout.tsx`, que es lo que emite
        // la etiqueta de verdad. Las dos cosas juntas o ninguna.
        disallow: ["/api/", "/docs"],
      },
    ],
    sitemap: "https://gasteizclick.javierpalacio.es/sitemap.xml",
  };
}
