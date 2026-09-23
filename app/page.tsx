import { Suspense, cache } from "react";
import type { Metadata } from "next";
import HeroSection from "./components/HeroSection";
import AtAGlanceStrip from "./components/AtAGlanceStrip";
import SectionsHub from "./components/SectionsHub";
import TodayStrip from "./components/TodayStrip";
import NextDaysSection from "./components/NextDaysSection";
import MoodFilter from "./components/MoodFilter";
import TopEventsSection from "./components/TopEventsSection";
import CategoryCarousel from "./components/CategoryCarousel";
import SocialProof from "./components/SocialProof";
import FiestasBlancaSection from "./components/FiestasBlancaSection";
import PartidosSection from "./components/PartidosSection";
import HomeEventsClient from "./components/HomeEventsClient";
import InstallBanner from "./components/InstallBanner";
import Newsletter from "./components/NewsLetter";
import { getProximosEventos, type Evento } from "@/lib/eventos";
import { getProximosPartidos } from "@/lib/partidos";
import { getPeliculas } from "@/lib/cines";
import { getKidsEventos } from "@/lib/kids";
import { getDeporteEventos } from "@/lib/deporte";
import { getPopularEvents } from "@/lib/popularity";
import { scrapeFiestasBlanca } from "@/lib/sources/fiestas-blanca";
import { isBlancaSeason } from "@/lib/blanca";
import { eventSlug } from "@/lib/slug";
import { JsonLd, itemListJsonLd } from "@/lib/seo";
import { CATEGORY_COLORS } from "@/lib/categories";

export const revalidate = 300;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const getCachedEventos = cache(getProximosEventos);

const CONCIERTOS_CATS = new Set(["Conciertos", "Música"]);
const CULTURA_CATS = new Set(["Teatro", "Exposiciones", "Cultura", "Visitas", "Danza", "Conferencias", "Talleres"]);
const INFANTIL_CATS = new Set(["Infantil", "Kids"]);

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
      <div className="max-w-5xl mx-auto">
        <div className="h-3 w-40 bg-surface rounded animate-pulse mb-8" />
        <div className="h-14 w-80 bg-surface rounded-xl animate-pulse mb-3" />
        <div className="h-5 w-64 bg-surface rounded-lg animate-pulse mb-10" />
        <div className="h-11 w-72 bg-surface rounded-xl animate-pulse" />
      </div>
    </div>
  );
}

function CarouselSkeleton() {
  return (
    <div className="px-5 sm:px-6 py-10 md:py-14">
      <div className="max-w-7xl mx-auto">
        <div className="h-6 w-56 bg-surface rounded-lg animate-pulse mb-6" />
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="w-64 shrink-0 aspect-[3/2] bg-surface rounded-2xl animate-pulse" />
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

async function NextDaysWithData() {
  const eventos = await getCachedEventos();
  return <NextDaysSection eventos={eventos} />;
}

async function TodayWithData() {
  const eventos = await getCachedEventos();
  return <TodayStrip eventos={eventos} />;
}

async function MoodWithData() {
  const [eventos, peliculas, infantil, deporte] = await Promise.all([
    getCachedEventos(),
    getPeliculas(),
    getKidsEventos(),
    getDeporteEventos(),
  ]);
  return (
    <MoodFilter
      eventos={eventos}
      peliculas={peliculas}
      infantil={infantil}
      deporte={deporte}
    />
  );
}

async function TopWithData() {
  const eventos = await getCachedEventos();
  const top = getPopularEvents(eventos, 10);
  return (
    <TopEventsSection
      events={top.map((e, i) => ({ ...e, ranking: i + 1 }))}
    />
  );
}

function filterByCats(eventos: Evento[], cats: Set<string>) {
  return eventos.filter((e) => cats.has(e.category || ""));
}

async function ConciertosCarousel() {
  const eventos = await getCachedEventos();
  return (
    <CategoryCarousel
      title="Conciertos"
      subtitle="Música en vivo en Vitoria-Gasteiz"
      href="/conciertos"
      events={filterByCats(eventos, CONCIERTOS_CATS).slice(0, 10)}
      categoryColors={CATEGORY_COLORS}
      tag="Música"
      tagColor="var(--hot)"
    />
  );
}

async function CulturaCarousel() {
  const eventos = await getCachedEventos();
  return (
    <CategoryCarousel
      title="Cultura"
      subtitle="Teatro, exposiciones y visitas"
      href="/culture"
      events={filterByCats(eventos, CULTURA_CATS).slice(0, 8)}
      categoryColors={CATEGORY_COLORS}
      variant="grid"
      tag="Cultura"
      tagColor="var(--violet)"
    />
  );
}

async function InfantilCarousel() {
  const eventos = await getCachedEventos();
  return (
    <CategoryCarousel
      title="Planes familiares"
      subtitle="Con niños y para todos"
      href="/kids"
      events={filterByCats(eventos, INFANTIL_CATS).slice(0, 8)}
      categoryColors={CATEGORY_COLORS}
      variant="grid"
      tag="Niños"
      tagColor="var(--teal)"
    />
  );
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

      <Suspense fallback={null}>
        <AtAGlanceWithData />
      </Suspense>

      <Suspense
        fallback={
          <section className="px-5 sm:px-6 py-8 md:py-12 max-w-7xl mx-auto">
            <div className="h-6 w-40 bg-surface rounded-lg animate-pulse mb-6" />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="h-[132px] bg-surface rounded-2xl animate-pulse" />
              ))}
            </div>
          </section>
        }
      >
        <SectionsHub />
      </Suspense>

      <Suspense
        fallback={
          <section className="px-5 sm:px-6 py-10 md:py-16 max-w-7xl mx-auto">
            <div className="h-3 w-20 bg-surface rounded mb-4" />
            <div className="h-8 w-64 bg-surface rounded-xl mb-6" />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 bg-surface rounded-2xl animate-pulse" />
              ))}
            </div>
          </section>
        }
      >
        <PartidosSection />
      </Suspense>

      <Suspense fallback={null}>
        <TodayWithData />
      </Suspense>

      <Suspense
        fallback={
          <section className="px-5 sm:px-6 py-8 md:py-14 max-w-5xl mx-auto">
            <div className="h-7 w-56 bg-surface rounded-lg animate-pulse mb-6" />
            <div className="flex gap-2 overflow-hidden">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="w-16 h-9 bg-surface rounded-full animate-pulse" />
              ))}
            </div>
          </section>
        }
      >
        <NextDaysWithData />
      </Suspense>

      <Suspense
        fallback={
          <section className="px-5 sm:px-6 py-8 md:py-10 max-w-7xl mx-auto">
            <div className="h-6 w-40 bg-surface rounded-lg animate-pulse" />
          </section>
        }
      >
        <MoodWithData />
      </Suspense>

      <Suspense fallback={<CarouselSkeleton />}>
        <TopWithData />
      </Suspense>

      <Suspense fallback={<CarouselSkeleton />}>
        <ConciertosCarousel />
      </Suspense>

      <Suspense fallback={null}>
        <SocialProofWithData />
      </Suspense>

      <Suspense fallback={<CarouselSkeleton />}>
        <CulturaCarousel />
      </Suspense>

      <Suspense fallback={<CarouselSkeleton />}>
        <InfantilCarousel />
      </Suspense>

      <Suspense fallback={<FiestasSkeleton />}>
        <FiestasWithData />
      </Suspense>

      <Suspense fallback={<EventsSkeleton />}>
        <EventsWithData />
      </Suspense>

      <InstallBanner />
      <Newsletter />
    </>
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

async function EventsWithData() {
  const eventos = await getCachedEventos();
  return <HomeEventsClient eventos={eventos} />;
}

async function AtAGlanceWithData() {
  const [eventos, partidos] = await Promise.all([
    getCachedEventos(),
    getProximosPartidos(1),
  ]);
  return <AtAGlanceStrip eventos={eventos} partidos={partidos.length} />;
}

async function SocialProofWithData() {
  const eventos = await getCachedEventos();
  // eslint-disable-next-line react-hooks/purity
  const since = Date.now();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 7);
  const thisWeek = eventos.filter((e) => {
    const d = new Date(e.date);
    return !isNaN(d.getTime()) && d >= today && d < horizon;
  }).length;
  return (
    <SocialProof eventCount={eventos.length} thisWeekCount={thisWeek} since={since} />
  );
}