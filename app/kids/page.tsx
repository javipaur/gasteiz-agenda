export const revalidate = 300;

import KidsPageClient from "../components/KidsPageClient";
import { getKidsEventos } from "@/lib/kids";
import { JsonLd, itemListJsonLd } from "@/lib/seo";

export const metadata = {
  title: "Planes con Niños en Vitoria-Gasteiz",
  description:
    "Actividades, talleres y planes familiares con niños en Vitoria-Gasteiz.",
  alternates: { canonical: "/kids" },
};

export default async function KidsPage() {
  const eventos = await getKidsEventos();
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
          "Planes con niños en Vitoria-Gasteiz",
          "/kids"
        )}
      />
      <KidsPageClient eventos={eventos} />
    </>
  );
}
