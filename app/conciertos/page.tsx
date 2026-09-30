export const revalidate = 300;

import ConciertosPageClient from "../components/ConciertosPageClient";
import { getConciertosEventos } from "@/lib/conciertos";
import { JsonLd, itemListJsonLd } from "@/lib/seo";

export const metadata = {
  title: "Conciertos en Vitoria-Gasteiz · Gasteiz Click",
  description:
    "Conciertos y música en vivo en Vitoria-Gasteiz: Jimmy Jazz, HellDorado, Musikaze y más.",
  alternates: { canonical: "/conciertos" },
};

export default async function ConciertosPage() {
  const eventos = await getConciertosEventos();

  return (
    <>
      <JsonLd
        data={itemListJsonLd(
          // El slug lo resuelve el agregador y viene en el evento, igual que en
          // `/culture`. Antes esta línea lo recalculaba con `eventSlug` sobre un
          // objeto al que antes le pisaba el `id` con un UUID, así que el JSON-LD
          // declaraba enlaces a `/evento/<algo>` que el detalle no resolvía.
          eventos.filter((e) => e.link).slice(0, 50),
          "Conciertos en Vitoria-Gasteiz",
          "/conciertos"
        )}
      />
      <ConciertosPageClient eventos={eventos} />
    </>
  );
}
