export const revalidate = 300;

import type { Metadata } from "next";
import GastronomiaPageClient from "../components/GastronomiaPageClient";
import {
  getSitios,
  getRutasPintxos,
  getEventosGastronomia,
  getEnsaladillaCampeonato,
  estadoEnsaladilla,
} from "@/lib/gastronomia";

export async function generateMetadata(): Promise<Metadata> {
  const ensaladilla = await getEnsaladillaCampeonato();
  const estado = ensaladilla ? estadoEnsaladilla(ensaladilla) : null;
  const desc =
    estado === "en-marcha"
      ? "Ruta del I Campeonato de la Ensaladilla (19–29 nov): 40 bares en 7 zonas, rutas de pintxos, sitios recomendados y agenda gastronómica en Vitoria-Gasteiz."
      : "Rutas de pintxos, sitios recomendados y agenda gastronómica en Vitoria-Gasteiz.";
  return {
    title: "Gastronomía en Vitoria-Gasteiz · Pintxos y dónde comer",
    description: desc,
    alternates: { canonical: "/gastronomia" },
  };
}

export default async function GastronomiaPage() {
  const [sitios, rutas, eventos, ensaladilla] = await Promise.all([
    getSitios(),
    getRutasPintxos(),
    getEventosGastronomia(),
    getEnsaladillaCampeonato(),
  ]);

  const ensaladillaEstado = ensaladilla ? estadoEnsaladilla(ensaladilla) : null;

  return (
    <GastronomiaPageClient
      sitios={sitios}
      rutas={rutas}
      eventos={eventos}
      ensaladilla={ensaladilla}
      ensaladillaEstado={ensaladillaEstado}
    />
  );
}