import { Suspense, cache } from "react";
import type { Metadata } from "next";
import HeroSection from "./components/HeroSection";
import TodayDecision from "./components/TodayDecision";
import NextDaysSection from "./components/NextDaysSection";
import TopEventsSection from "./components/TopEventsSection";
import CategoryCarousel from "./components/CategoryCarousel";
import FiestasBlancaSection from "./components/FiestasBlancaSection";
import PartidosSection from "./components/PartidosSection";
import HomeEventsClient from "./components/HomeEventsClient";
import InstallBanner from "./components/InstallBanner";
import Moradillos2027Strip from "./components/Moradillos2027Strip";
import Newsletter from "./components/NewsLetter";
import { getProximosEventos, type Evento } from "@/lib/eventos";
import { seleccionHome } from "@/lib/home-seleccion";
import { localDateStr, partirEnSemana } from "@/lib/utils";
import { scrapeFiestasBlanca } from "@/lib/sources/fiestas-blanca";
import { isBlancaSeason } from "@/lib/blanca";
import { JsonLd, itemListJsonLd } from "@/lib/seo";
import { CATEGORY_COLORS } from "@/lib/categories";
import { mostrarEnPortada } from "@/lib/moradillos-2027";
import { navidadDelDia } from "@/lib/navidad-vitoria";

export const revalidate = 300;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const getCachedEventos = cache(getProximosEventos);

/**
 * La decisión de los dos bloques centrales se calcula **una sola vez por
 * petición**. `HoyWithData` y `TopWithData` son hermanos bajo `Suspense`, así que
 * cada uno leía el agregado y el reloj por su cuenta: con dos `Date.now()` y dos
 * listas de hoy, el mismo evento podía aparecer arriba y abajo sin que nada
 * fallara. `cache` de React los ata a la misma respuesta; `seleccionHome` decide
 * cuáles seis van arriba y excluye ese conjunto del riel.
 */
const getSeleccionHome = cache(async () => {
  const eventos = await getCachedEventos();
  return seleccionHome(eventos, Date.now());
});

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
  const ahora = Date.now();
  // La ventana de Navidad se decide aquí, en el servidor y en Europe/Madrid. Si el
  // cliente la calculara por su cuenta tendríamos dos relojes y dos husos para la
  // misma lista, que es justo lo que evita el prop `ahora`.
  const navidad = navidadDelDia(new Date(ahora));
  return <HeroSection eventos={eventos} ahora={ahora} navidad={navidad} />;
}

/**
 * `Hoy en Vitoria` responde a «¿qué hago hoy?» con una lista corta y el total
 * visible. No es un horario: medido el 24 de noviembre de 2026 solo 20 de los 69
 * eventos del día traen hora, así que una barra de franjas horarias mentiría
 * sobre los otros 49. Cuáles seis se eligen —y cómo se excluyen del riel de
 * abajo— lo decide `lib/home-seleccion.ts`; el motivo del formato está en
 * `TodayDecision.tsx`.
 */
async function TodayWithData() {
  const { planesDeHoy, totalDeHoy } = await getSeleccionHome();
  return <TodayDecision planesDeHoy={planesDeHoy} totalDeHoy={totalDeHoy} />;
}

async function NextDaysWithData() {
  const eventos = await getCachedEventos();
  // eslint-disable-next-line react-hooks/purity
  return <NextDaysSection eventos={eventos} ahora={Date.now()} />;
}

async function TopWithData() {
  const { recomendadosDeHoy } = await getSeleccionHome();
  // El riel no es "los diez más populares de toda la agenda" sino "lo que
  // recomendamos **hoy** sin lo que ya se ha enseñado en el bloque de arriba". Es
  // el mismo criterio que usan `/hoy` y el paquete de redes, para que la home y
  // el post de Instagram no digan dos cosas distintas sobre el mismo día. El
  // rótulo de `TopEventsSection` se cambió con esto, porque "Top 10" sobre una
  // lista de un día era mentira. La ventana y la exclusión viven en
  // `lib/home-seleccion.ts`, que es el único sitio que decide las dos listas.
  return <TopEventsSection events={recomendadosDeHoy} />;
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

function MoradillosWithData() {
  // La fecha se pasa como dato y no se lee dentro del componente que pinta,
  // igual que en `HeroWithData` y en `FiestasWithData`. El bloque desaparece
  // solo pasado julio de 2027: no depende de que alguien recuerde quitarlo.
  return mostrarEnPortada(new Date()) ? <Moradillos2027Strip /> : null;
}

export default async function HomeEventsPage() {
  return (
    <>
      <Suspense fallback={null}>
        <AgendaJsonLd />
      </Suspense>

      {/* 1. La puerta: identidad, buscador y dos contadores. Sin tarjetas, para
          que el primer dato de la página sea una pregunta y no un plan que luego
          se repetiría tres veces más abajo. */}
      <Suspense fallback={<HeroSkeleton />}>
        <HeroWithData />
      </Suspense>

      {/* Va aquí y no al final de la lista de eventos porque, al final, en un
          móvil de 390 px cae a más de veinte mil píxeles del origen: medido en
          producción, el botón quedaba a 9.776 px y la home no mostraba nada
          instalable sin hacer scroll. Arriba de la agenda es donde se ve. */}
      <InstallBanner />

      {/* 2. Cuándo: los planes de hoy en una lista corta. Sin pestañas de hora:
          solo 20 de 69 eventos la traen. */}
      <Suspense
        fallback={
          <section className="px-5 sm:px-6 py-10 md:py-14 bg-bg-muted">
            <div className="max-w-7xl mx-auto">
              <div className="h-6 w-56 bg-surface rounded-lg animate-pulse mb-6" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-[84px] bg-surface rounded-2xl animate-pulse" />
                ))}
              </div>
            </div>
          </section>
        }
      >
        <TodayWithData />
      </Suspense>

      {/* 3. Qué merece la pena: el mismo criterio que `/hoy` y el post. Antes
          esta lista se llamaba «Top 10» y salía antes del día; ahora el día va
          primero porque es la pregunta con la que llega quien no sabe qué hacer. */}
      <Suspense fallback={<CarouselSkeleton />}>
        <TopWithData />
      </Suspense>

      {/* 4. Todo lo que queda en la semana, con la pestaña «Hoy» quitada: el
          bloque 2 ya responde a hoy y no tiene sentido pedir lo mismo dos veces. */}
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

      {/* 5. Por categoria: los carruseles y los partidos en un solo sitio.
          `SectionsHub` era la tercera puerta a las mismas categorias y hacia su
          propio `getPeliculas()`; con el buscador del hero y el menu de la
          cabecera no hace falta, y quitarlo ahorra una peticion. */}
      <Suspense fallback={<CarouselSkeleton />}>
        <ConciertosCarousel />
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
        <CulturaCarousel />
      </Suspense>

      <Suspense fallback={<CarouselSkeleton />}>
        <InfantilCarousel />
      </Suspense>

      <Suspense fallback={<FiestasSkeleton />}>
        <FiestasWithData />
      </Suspense>

      <MoradillosWithData />

      {/* 6. Alcance y cierre: lo que queda después de la semana, sin repetirla,
          y la newsletter. */}
      <Suspense fallback={<EventsSkeleton />}>
        <EventsWithData />
      </Suspense>

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

/**
 * **La última sección de la portada no repite la semana.**
 *
 * Medido en producción el 23 de octubre de 2026: pintaba doce tarjetas y **las
 * doce** estaban ya en «Próximos 7 días». No era un fallo de composición sino de
 * aritmética — las dos secciones recibían la agenda entera y cada una cortaba por
 * su cuenta, así que la de abajo cortaba exactamente por donde empezaba la de
 * arriba.
 *
 * Ahora recibe solo lo de **después** de la semana, y eso no es un hueco: ese
 * mismo día había 1.968 eventos próximos, 448 dentro de la semana y **1.520 más
 * allá del día séptimo**, porque el calendario municipal se publica con meses de
 * antelación. La sección deja de ser un eco de la anterior y pasa a ser alcance.
 *
 * El enlace tampoco es `/culture`. «La agenda completa» es `/agenda/AAAA-MM`,
 * que es donde está la lista entera —lo mismo que hace el pie—, y `/culture` es
 * la vista cultural: dejaba fuera deporte, niños y agenda municipal.
 */
async function EventsWithData() {
  const eventos = await getCachedEventos();
  // El reloj se lee aquí y no en el cliente por el mismo motivo que en
  // `HeroWithData` y `NextDaysWithData`: la home tiene `revalidate = 300`, así que
  // la ventana se decide una vez por render. Si la calculara el cliente, el
  // servidor hidrataría una lista y el navegador otra —y con la pestaña abierta
  // cruzando la medianoche, el corte se movería solo mientras nadie mira—.
  // eslint-disable-next-line react-hooks/purity
  const ahora = Date.now();
  const { despues } = partirEnSemana(eventos, ahora);
  return (
    <HomeEventsClient
      eventos={despues}
      mesHref={`/agenda/${localDateStr(new Date(ahora)).slice(0, 7)}`}
    />
  );
}
