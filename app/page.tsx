import { Suspense, cache } from "react";
import type { Metadata } from "next";
import HeroSection from "./components/HeroSection";
import AtAGlanceStrip from "./components/AtAGlanceStrip";
import SectionsHub from "./components/SectionsHub";
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
import { recomendados } from "@/lib/recomendados";
import { localDateStr } from "@/lib/utils";
import { scrapeFiestasBlanca } from "@/lib/sources/fiestas-blanca";
import { isBlancaSeason } from "@/lib/blanca";
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
        // Sin `.map`: `getProximosEventos` ya devuelve `AgendaEvento`, que trae
        // `slug` resuelto por el agregador. Aquí se reconstruía con `eventSlug`
        // sobre los mismos campos, y por lo tanto podía apuntar a un slug
        // distinto del que resuelve `/evento/[slug]`.
        eventos.filter((e) => e.link).slice(0, 30),
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
  // El instante se pasa como prop y no se lee dentro del componente. Es lo mismo
  // que hace `app/culture/page.tsx` con su `eslint-disable react-hooks/purity`
  // justificado: el reloj es del servidor, y leerlo en un `useMemo` del cliente
  // produce un memo impuro que puede devolver su valor cacheado para siempre.
  // La regla `react-hooks/purity` salta aquí, y es un falso positivo: esto es una
  // página de servidor que se renderiza una vez por petición, así que no hay
  // re-render de cliente contra el que el valor pueda quedarse viejo. Al pasarlo
  // como prop, el `useMemo` del cliente queda puro, que es donde sí importaba:
  // antes leía el reloj dentro del memo y podía devolver la cuenta cacheada
  // indefinidamente. Mismo tratamiento que `app/culture/page.tsx`.
  // eslint-disable-next-line react-hooks/purity
  return <HeroSection eventos={eventos} ahora={Date.now()} />;
}

/**
 * **Aquí estaba `TodayWithData`, y ya no.**
 *
 * `TodayStrip` pintaba **los mismos 35 eventos** que la rejilla de `Próximos 7 días`,
 * medido en producción el 9 de octubre de 2026: cuarenta y dos eventos únicos en la
 * página y treinta y cinco repetidos en tres secciones. Era un carrusel horizontal de
 * 222 px delante de una rejilla de 3.845 px, y además el peor de los dos porque
 * `scrollbar-none` ocultaba la barra, de modo que lo único que decía que se podía
 * arrastrar era la tarjeta que quedaba cortada.
 *
 * El lugar lo ocupa ahora `TopWithData`, el riel de recomendados: mismo criterio que
 * el post de Instagram y el único que ordena por algo, así que el día queda en una
 * jerarquía —primero lo que recomendamos, después todo lo que hay— en vez de tres
 * veces lo mismo.
 */
async function NextDaysWithData() {
  const eventos = await getCachedEventos();
  // eslint-disable-next-line react-hooks/purity
  return <NextDaysSection eventos={eventos} ahora={Date.now()} />;
}

async function MoodWithData() {
  // El segundo elemento de `getPeliculas` son los cines que fallaron y el
  // componente no lo necesita: `MoodFilter` solo pinta peliculas, asi que se
  // descarta aqui en vez de propagar el detalle por toda la pagina.
  const [eventos, { peliculas }, infantil, deporte] = await Promise.all([
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
  // `recomendados()` y no `getPopularEvents()`: el riel ya no es "los diez más
  // populares de toda la agenda" sino "lo que recomendamos **hoy**", y es el mismo
  // criterio que usan `/hoy` y el paquete de redes, para que la home y el post de
  // Instagram no digan dos cosas distintas sobre el mismo día. El rótulo de
  // `TopEventsSection` se cambió con esto, porque "Top 10" sobre una lista de un día
  // era mentira.
  //
  // `getPopularEvents` **no** desaparece: `HeroSection` lo sigue usando para el
  // destacado, y allí el criterio sin ventana es el correcto, porque una única tarjeta
  // protagonista quiere "lo más popular de todo" y no "lo de hoy".
  //
  // El `hoy` va como argumento y no con el `new Date()` por defecto del selector, por el
  // mismo motivo que en `HeroSection` y `NextDaysSection`: la home tiene `revalidate =
  // 300`, así que un reloj leído aquí dentro se congela contra el día con el que se
  // calculó el primer render —abrir la web antes de medianoche y dejarla abierta te
  // deja el día nuevo puntuando con el de ayer.
  // eslint-disable-next-line react-hooks/purity
  const ahora = Date.now();
  const top = recomendados(eventos, {
    desde: localDateStr(new Date(ahora)),
    hasta: localDateStr(new Date(ahora)),
    limite: 10,
    hoy: new Date(ahora),
  });
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
  // El instante se pasa como prop y no se lee dentro del componente, exactamente
  // igual que en `HeroWithData` y en `NextDaysWithData` dos líneas más arriba. Antes
  // `FiestasBlancaSection` leía `new Date()` en su propio cuerpo para decidir qué
  // fiestas quedaban por pasar, y eso son dos fallos: un render impuro —el valor se
  // recalcula en cada pasada sin que nada lo pida— y un día **UTC** usado como si
  // fuera el día local, que entre las 00:00 y las 01:59 de Madrid descarta la fiesta
  // de hoy y pinta la de ayer.
  //
  // La regla `react-hooks/purity` salta aquí y es un falso positivo por el mismo
  // motivo que en las otras dos: esto es una página de servidor que se renderiza una
  // vez por petición, así que no hay re-render de cliente contra el que el valor
  // pueda quedarse viejo. El prop es lo que hace el render del cliente puro.
  // eslint-disable-next-line react-hooks/purity
  return <FiestasBlancaSection fiestas={fiestas} ahora={Date.now()} />;
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

      <Suspense fallback={<CarouselSkeleton />}>
        <TopWithData />
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
  // Sin `since`. `SocialProof` ya no lleva `FreshnessBadge`: el badge mide
  // `Date.now() - since`, así que un `since` tomado aquí sería el instante del
  // render y la etiqueta daría "Actualizado hace 0 s" al abrir, subiendo luego
  // mientras la pestaña siga abierta aunque los datos no cambien. El `since` de
  // verdad es el `fetchedAt` que llega en la respuesta de la API, y eso sólo lo
  // tienen `/farmacias` y `/bus`. Aquí la cifra honesta es la de "Diaria /
  // actualización", que ya está en el propio componente.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 7);
  const thisWeek = eventos.filter((e) => {
    const d = new Date(e.date);
    return !isNaN(d.getTime()) && d >= today && d < horizon;
  }).length;
  return <SocialProof eventCount={eventos.length} thisWeekCount={thisWeek} />;
}