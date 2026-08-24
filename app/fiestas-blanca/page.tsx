export const revalidate = 300;

import Link from "next/link";
import FiestasBlancaPageClient from "../components/FiestasBlancaPageClient";
import { scrapeFiestasBlanca } from "@/lib/sources/fiestas-blanca";
import { eventSlug } from "@/lib/slug";
import { JsonLd, itemListJsonLd } from "@/lib/seo";
import { isBlancaSeason, blancaNextEditionYear } from "@/lib/blanca";

export async function generateMetadata() {
  if (isBlancaSeason()) {
    return {
      title: "Fiestas de la Virgen Blanca 2026 - Vitoria-Gasteiz",
      description:
        "Programa completo de las Fiestas de la Virgen Blanca 2026 en Vitoria-Gasteiz. Conciertos, verbenas, fuegos artificiales y más.",
      alternates: { canonical: "/fiestas-blanca" },
    };
  }
  return {
    title: "Fiestas de la Virgen Blanca - Vitoria-Gasteiz",
    description:
      "Las Fiestas de la Virgen Blanca se celebran del 4 al 9 de agosto en Vitoria-Gasteiz. Consulta aquí el programa cuando llegue la próxima edición.",
    alternates: { canonical: "/fiestas-blanca" },
    robots: { index: false, follow: true },
  };
}

function BlancaOffSeason({ year }: { year: number }) {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-28 md:pt-36 pb-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-accent mb-6">
          Vitoria-Gasteiz · Agosto
        </p>
        <h1 className="font-display text-5xl md:text-6xl font-semibold tracking-tight text-fg">
          La Blanca <span className="text-accent">{year}</span>
        </h1>
        <p className="mt-6 text-base md:text-lg leading-relaxed text-fg-subtle">
          Las fiestas de la Virgen Blanca se celebran del 4 al 9 de agosto.
          Cuando se publique el programa completo lo encontrarás aquí: conciertos,
          verbenas, fuegos artificiales y todo lo que mueve la ciudad esa semana.
        </p>
        <Link
          href="/culture"
          className="group inline-flex items-center gap-3 mt-10 rounded-full border border-border bg-surface px-6 py-3 font-medium text-sm transition-all duration-300 hover:border-accent/40 hover:text-accent"
        >
          Ver agenda actual
          <span className="grid size-6 place-items-center rounded-full bg-accent/10 text-accent transition-transform duration-300 group-hover:translate-x-1">→</span>
        </Link>
      </div>
    </section>
  );
}

export default async function FiestasBlancaPage() {
  if (!isBlancaSeason()) {
    const year = blancaNextEditionYear();
    return (
      <>
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Event",
            name: `Fiestas de la Virgen Blanca ${year}`,
            startDate: `${year}-08-04`,
            endDate: `${year}-08-09`,
            eventStatus: "https://schema.org/EventScheduled",
            location: {
              "@type": "Place",
              name: "Vitoria-Gasteiz",
              address: { "@type": "PostalAddress", addressLocality: "Vitoria-Gasteiz", addressCountry: "ES" },
            },
          }}
        />
        <BlancaOffSeason year={year} />
      </>
    );
  }

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
