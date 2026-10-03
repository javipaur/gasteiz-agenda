import type { Metadata } from "next";
import BusPageClient from "../components/BusPageClient";

// La plantilla de `app/layout.tsx` ya añade " | Gasteiz Click". Escribir la
// marca aquí también salía en el `<title>` y en la pestaña: dos veces, con el
// separador en medio.
export const metadata: Metadata = {
  title: "Autobús y tranvía en Vitoria-Gasteiz",
  description:
    "Consulta las próximas llegadas del TUVISA y el tranvía en Vitoria-Gasteiz: busca tu parada y mira los tiempos reales.",
  alternates: { canonical: "/bus" },
};

export default function BusPage() {
  return <BusPageClient />;
}