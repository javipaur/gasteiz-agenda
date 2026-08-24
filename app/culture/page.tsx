export const revalidate = 300;

import type { Metadata } from "next";
import CulturePageClient from "../components/CulturePageClient";
import { getCultureEventos, CulturaEvento } from "@/lib/cultura";
import { eventSlug } from "@/lib/slug";
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
          eventos
            .filter((e) => e.link)
            .slice(0, 50)
            .map((e) => ({ ...e, slug: eventSlug(e), id: eventSlug(e) })),
          "Agenda cultural de Vitoria-Gasteiz",
          "/culture"
        )}
      />
      <CulturePageClient eventos={eventos} />
    </>
  );
}
