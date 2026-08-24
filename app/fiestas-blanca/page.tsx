export const revalidate = 300;

import FiestasBlancaPageClient from "../components/FiestasBlancaPageClient";
import { scrapeFiestasBlanca } from "@/lib/sources/fiestas-blanca";
import { eventSlug } from "@/lib/slug";
import { JsonLd, itemListJsonLd } from "@/lib/seo";

export const metadata = {
  title: "Fiestas de la Virgen Blanca 2026 - Vitoria-Gasteiz",
  description:
    "Programa completo de las Fiestas de la Virgen Blanca 2026 en Vitoria-Gasteiz. Conciertos, verbenas, fuegos artificiales y más.",
  alternates: { canonical: "/fiestas-blanca" },
};

export default async function FiestasBlancaPage() {
  const fiestas = await scrapeFiestasBlanca();

  return (
    <>
      <JsonLd
        data={itemListJsonLd(
          fiestas
            .filter((f) => !f.cancelled && f.url && f.date)
            .map((f) => ({
              id: f.id,
              slug: eventSlug({ title: f.title, date: f.date, link: f.url }),
              title: f.title,
              date: f.date,
              dateEnd: f.dateEnd || undefined,
              time: f.timeStart || undefined,
              image: f.image?.startsWith("http") ? f.image : undefined,
              location: f.location || "Vitoria-Gasteiz",
              link: f.url,
              category: f.category || "La Blanca",
              source: "fiestas-blanca",
            }))
            .slice(0, 100),
          "Programa de las Fiestas de la Virgen Blanca 2026",
          "/fiestas-blanca"
        )}
      />
      <FiestasBlancaPageClient fiestas={fiestas} />
    </>
  );
}
