import { Suspense, cache } from "react";
import HeroSection from "./components/HeroSection";
import CategoriesGrid from "./components/CategoriesGrid";
import FiestasBlancaSection from "./components/FiestasBlancaSection";
import HomeEventsClient from "./components/HomeEventsClient";
import InstallBanner from "./components/InstallBanner";
import Newsletter from "./components/NewsLetter";
import { getProximosEventos } from "@/lib/eventos";
import { scrapeFiestasBlanca } from "@/lib/sources/fiestas-blanca";
import { isBlancaSeason } from "@/lib/blanca";
import { eventSlug } from "@/lib/slug";
import { JsonLd, itemListJsonLd } from "@/lib/seo";

export const revalidate = 300;

const getCachedEventos = cache(getProximosEventos);

async function AgendaJsonLd() {
  const eventos = await getCachedEventos();
  return (
    <JsonLd
      data={itemListJsonLd(
        eventos
          .filter((e) => e.link)
          .slice(0, 30)
          .map((e) => ({ ...e, slug: eventSlug(e) })),
        "Próximos eventos en Vitoria-Gasteiz",
        "/"
      )}
    />
  );
}

function HeroSkeleton() {
  return (
    <div className="px-5 sm:px-6 pt-28 pb-12 md:pt-36 md:pb-16">
      <div className="max-w-7xl mx-auto">
        <div className="h-3 w-40 bg-surface rounded animate-pulse mb-8" />
        <div className="h-14 w-80 bg-surface rounded-xl animate-pulse mb-3" />
        <div className="h-5 w-64 bg-surface rounded-lg animate-pulse mb-10" />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="w-12 h-12 bg-surface rounded-full animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

function EventsSkeleton() {
  return (
    <div className="px-5 sm:px-6 py-12 md:py-16">
      <div className="max-w-7xl mx-auto">
        <div className="h-6 w-56 bg-surface rounded-lg animate-pulse mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
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
    <div className="px-5 sm:px-6 py-16 md:py-20">
      <div className="max-w-7xl mx-auto">
        <div className="h-3 w-20 bg-surface rounded animate-pulse mb-4" />
        <div className="h-8 w-64 bg-surface rounded-xl animate-pulse mb-2" />
        <div className="h-4 w-48 bg-surface rounded-lg animate-pulse mb-10" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-[4/3] bg-surface rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

async function HeroWithData() {
  const eventos = await getCachedEventos();
  return <HeroSection eventos={eventos} />;
}

async function EventsWithData() {
  const eventos = await getCachedEventos();
  return <HomeEventsClient eventos={eventos} />;
}

async function FiestasWithData() {
  if (!isBlancaSeason()) return null;
  const fiestas = await scrapeFiestasBlanca();
  return <FiestasBlancaSection fiestas={fiestas} />;
}

export default async function HomeEventsPage() {
  return (
    <>
      <Suspense fallback={null}>
        <AgendaJsonLd />
      </Suspense>

      <Suspense fallback={<HeroSkeleton />}>
        <HeroWithData />
      </Suspense>

      <Suspense fallback={<FiestasSkeleton />}>
        <FiestasWithData />
      </Suspense>

      <Suspense
        fallback={
          <section className="px-5 sm:px-6 py-12 md:py-16 max-w-7xl mx-auto">
            <div className="h-7 w-64 bg-surface rounded-lg animate-pulse mb-6" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-[68px] bg-surface rounded-xl animate-pulse" />
              ))}
            </div>
          </section>
        }
      >
        <CategoriesGrid />
      </Suspense>

      <Suspense fallback={<EventsSkeleton />}>
        <EventsWithData />
      </Suspense>

      <InstallBanner />
      <Newsletter />
    </>
  );
}
