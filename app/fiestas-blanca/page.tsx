export const revalidate = 300;

import FiestasBlancaPageClient from "../components/FiestasBlancaPageClient";
import { scrapeFiestasBlanca } from "@/lib/sources/fiestas-blanca";

export const metadata = {
  title: "Fiestas de la Virgen Blanca 2026 - Vitoria-Gasteiz",
  description:
    "Programa completo de las Fiestas de la Virgen Blanca 2026 en Vitoria-Gasteiz. Conciertos, verbenas, fuegos artificiales y más.",
};

export default async function FiestasBlancaPage() {
  const fiestas = await scrapeFiestasBlanca();
  return <FiestasBlancaPageClient fiestas={fiestas} />;
}
