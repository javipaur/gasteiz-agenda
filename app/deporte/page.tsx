export const revalidate = 300;

import { Suspense } from "react";
import type { Metadata } from "next";
import SportPageClient from "../components/SportPageClient";
import ProMatchesBlock from "../components/ProMatchesBlock";
import { getProximosPartidos } from "@/lib/partidos";
import { getDeporteEventos } from "@/lib/deporte";
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
    title: "Agenda Deportiva en Vitoria-Gasteiz",
    description:
      "Carreras, senderismo y eventos deportivos en Vitoria-Gasteiz.",
    alternates: { canonical: "/deporte" },
  };
}

export default async function DeportePage() {
  const [eventos, partidos] = await Promise.all([
    getDeporteEventos(),
    getProximosPartidos(3),
  ]);
  return (
    <>
      <JsonLd
        data={itemListJsonLd(
          eventos
            .filter((e) => e.link && e.link !== "#")
            // El slug lo resuelve el agregado y no se recalcula aquí: si la tarjeta
            // y el detalle calcularan el slug por su cuenta, bastaría con que un
            // dato variara para que el enlace diera 404.
            .map((e) => ({ ...e, slug: e.slug, location: e.location || "Vitoria-Gasteiz" }))
            .slice(0, 50),
          "Agenda deportiva de Vitoria-Gasteiz",
          "/deporte"
        )}
      />
      <Suspense
        fallback={
          <div className="px-5 sm:px-6 py-10 max-w-7xl mx-auto">
            <div className="h-6 w-56 bg-surface rounded-lg animate-pulse" />
          </div>
        }
      >
        <ProMatchesBlock partidos={partidos} />
      </Suspense>
      <SportPageClient eventos={eventos} heroFirst={partidos.length === 0} />
    </>
  );
}
