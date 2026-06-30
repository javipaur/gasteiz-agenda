export const dynamic = 'force-dynamic';

import HeroSection from "./components/HeroSection";
import CategoriesGrid from "./components/CategoriesGrid";
import HomeEvents from "./components/HomeEvents";
import Newsletter from "./components/NewsLetter";
import { getProximosEventos } from "@/lib/eventos";

export default async function HomeEventsPage() {
  const eventos = await getProximosEventos();

  return (
    <>
      <HeroSection eventos={eventos} />
      <CategoriesGrid />
      <HomeEvents />
      <Newsletter />
    </>
  );
}
