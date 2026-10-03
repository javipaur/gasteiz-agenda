import type { Metadata } from "next";

/**
 * Por qué esto es un layout y no está en `app/docs/page.tsx`.
 *
 * La página carga Swagger por CDN y necesita `"use client"`. Un componente de
 * cliente no puede exportar `metadata`, así que la etiqueta `noindex` —que es la
 * que de verdad impide la indexación— no tenía dónde declararse: `app/robots.ts`
 * la insinúa, y con la barra final de más ni siquiera eso. El layout sí es un
 * módulo de servidor y es el sitio que Next documenta para esto.
 *
 * Sin este fichero, `/docs` queda indexable con el OpenAPI público duplicado en
 * la web: el buscador lo indexa, lo cacha y ya no refleja lo que dice
 * `public/openapi.yaml`. La comprobación vive en
 * `__tests__/seo-titulos-y-docs.test.ts`.
 */
export const metadata: Metadata = {
  title: "Documentación de la API",
  robots: { index: false, follow: false },
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
