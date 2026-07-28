import { Suspense } from "react";
import HeroSection from "./components/HeroSection";
import CategoriesGrid from "./components/CategoriesGrid";
import FiestasBlancaSection from "./components/FiestasBlancaSection";
import HomeEventsClient from "./components/HomeEventsClient";
import InstallBanner from "./components/InstallBanner";
import Newsletter from "./components/NewsLetter";
import { getProximosEventos } from "@/lib/eventos";
import { scrapeFiestasBlanca } from "@/lib/sources/fiestas-blanca";

export const revalidate = 300;

function HeroSkeleton() {
  return (
    <div className="px-5 sm:px-6 py-20 md:py-28">
      <div className="max-w-7xl mx-auto">
        <div className="h-12 w-64 bg-surface rounded-xl animate-pulse mb-4" />
        <div className="h-5 w-48 bg-surface rounded-lg animate-pulse mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-[4/3] bg-surface rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

function EventsSkeleton() {
  return (
    <div className="px-5 sm:px-6 py-16 md:py-24">
      <div className="max-w-7xl mx-auto">
        <div className="h-8 w-56 bg-surface rounded-xl animate-pulse mb-3" />
        <div className="h-4 w-40 bg-surface rounded-lg animate-pulse mb-12" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-7">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="aspect-[4/3] bg-surface rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

function FiestasSkeleton() {
  return (
    <div className="px-5 sm:px-6 py-20 md:py-28">
      <div className="max-w-7xl mx-auto">
        <div className="h-8 w-64 bg-surface rounded-xl animate-pulse mb-4" />
        <div className="h-4 w-56 bg-surface rounded-lg animate-pulse mb-12" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-7">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-[4/3] bg-surface rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

async function HeroWithData() {
  const eventos = await getProximosEventos();
  return <HeroSection eventos={eventos} />;
}

async function EventsWithData() {
  const eventos = await getProximosEventos();
  return <HomeEventsClient eventos={eventos} />;
}

async function FiestasWithData() {
  const fiestas = await scrapeFiestasBlanca();
  return <FiestasBlancaSection fiestas={fiestas} />;
}

export default async function HomeEventsPage() {
  return (
    <>
      <Suspense fallback={<HeroSkeleton />}>
        <HeroWithData />
      </Suspense>

      <Suspense fallback={<FiestasSkeleton />}>
        <FiestasWithData />
      </Suspense>

      <CategoriesGrid />

      <Suspense fallback={<EventsSkeleton />}>
        <EventsWithData />
      </Suspense>

      <InstallBanner />
      <Newsletter />
    </>
  );
}
