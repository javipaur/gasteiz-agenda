import type { Metadata } from "next";
import BusPageClient from "../components/BusPageClient";

export const metadata: Metadata = {
  title: "Autobús y tranvía en Vitoria-Gasteiz · Gasteiz Click",
  description:
    "Consulta las próximas llegadas del TUVISA y el tranvía en Vitoria-Gasteiz: busca tu parada y mira los tiempos reales.",
  alternates: { canonical: "/bus" },
};

export default function BusPage() {
  return <BusPageClient />;
}