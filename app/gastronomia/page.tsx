export const revalidate = 300;

import type { Metadata } from "next";
import GastronomiaPageClient from "../components/GastronomiaPageClient";
import { getSitios, getRutasPintxos, getEventosGastronomia } from "@/lib/gastronomia";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Gastronomía en Vitoria-Gasteiz · Pintxos y dónde comer",
    description:
      "Rutas de pintxos, sitios recomendados y agenda gastronómica en Vitoria-Gasteiz.",
    alternates: { canonical: "/gastronomia" },
  };
}

export default async function GastronomiaPage() {
  const [sitios, rutas, eventos] = await Promise.all([
    getSitios(),
    getRutasPintxos(),
    getEventosGastronomia(),
  ]);

  return <GastronomiaPageClient sitios={sitios} rutas={rutas} eventos={eventos} />;
}