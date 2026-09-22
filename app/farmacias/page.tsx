import type { Metadata } from "next";
import FarmaciasPageClient from "../components/FarmaciasPageClient";

export const metadata: Metadata = {
  title: "Farmacias de guardia en Vitoria-Gasteiz · Gasteiz Click",
  description:
    "Farmacias de guardia abiertas hoy en Vitoria-Gasteiz: dirección, teléfono y mapa interactivo.",
  alternates: { canonical: "/farmacias" },
};

export default function FarmaciasPage() {
  return <FarmaciasPageClient />;
}