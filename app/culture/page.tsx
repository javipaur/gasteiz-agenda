export const revalidate = 300;

import type { Metadata } from "next";
import CulturePageClient from "../components/CulturePageClient";
import { getCultureEventos } from "@/lib/cultura";
import { JsonLd, itemListJsonLd } from "@/lib/seo";

type PageProps = {
  searchParams: Promise<{ q?: string }>;
};

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const { q } = await searchParams;

  if (q) {
    return {
      title: `Búsqueda: ${q}`,
      robots: { index: false, follow: true },
    };
  }

  return {
    title: "Agenda Cultural en Vitoria-Gasteiz",
    description:
      "Teatro, conciertos, exposiciones y cultura en Vitoria-Gasteiz.",
    alternates: { canonical: "/culture" },
  };
}

export default async function CulturePage() {
  const eventos = await getCultureEventos();

  return (
    <>
      <JsonLd
        data={itemListJsonLd(
          // El slug lo resuelve el agregado y viene en el evento. Antes esta línea
          // lo recalculaba y además pisaba el `id` con el slug, con lo que el
          // JSON-LD declaraba un id que ningún evento tenía. `/evento/[slug]`
          // resuelve contra el agregado, así que si el cálculo se separara de él
          // el enlace daría 404.
          eventos.filter((e) => e.link).slice(0, 50),
          "Agenda cultural de Vitoria-Gasteiz",
          "/culture"
        )}
      />
      <CulturePageClient
        eventos={eventos}
        // La regla `react-hooks/purity` salta aquí, y es un falso positivo: esta
        // es una página de servidor que se renderiza una vez por petición, así
        // que no hay re-render de cliente contra el que el valor pueda quedarse
        // viejo. Al pasarlo como prop, el `useMemo` del cliente queda puro, que es
        // donde sí importaba: antes leía el reloj dentro del memo y podía
        // devolver la ordenación cacheada indefinidamente.
        // eslint-disable-next-line react-hooks/purity
        ahora={Date.now()}
      />
    </>
  );
}
