export const revalidate = 300;

import HeroSection from "./components/HeroSection";
import CategoriesGrid from "./components/CategoriesGrid";
import HomeEventsClient from "./components/HomeEventsClient";
import Newsletter from "./components/NewsLetter";
import { getProximosEventos } from "@/lib/eventos";

export default async function HomeEventsPage() {
  const eventos = await getProximosEventos();

  return (
    <>
      <HeroSection eventos={eventos} />
      <CategoriesGrid />
      <HomeEventsClient eventos={eventos} />
      <Newsletter />
    </>
  );
}
