export const revalidate = 300;

import HeroSection from "./components/HeroSection";
import CategoriesGrid from "./components/CategoriesGrid";
import FiestasBlancaSection from "./components/FiestasBlancaSection";
import HomeEventsClient from "./components/HomeEventsClient";
import InstallBanner from "./components/InstallBanner";
import Newsletter from "./components/NewsLetter";
import { getProximosEventos } from "@/lib/eventos";
import { scrapeFiestasBlanca } from "@/lib/sources/fiestas-blanca";

export default async function HomeEventsPage() {
  const [eventos, fiestas] = await Promise.all([
    getProximosEventos(),
    scrapeFiestasBlanca(),
  ]);

  return (
    <>
      <HeroSection eventos={eventos} />
      <FiestasBlancaSection fiestas={fiestas} />
      <CategoriesGrid />
      <HomeEventsClient eventos={eventos} />
      <InstallBanner />
      <Newsletter />
    </>
  );
}
