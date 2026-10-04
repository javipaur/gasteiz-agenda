import type { Metadata } from "next";
import Link from "next/link";
import {
  buscarAgenda,
  BUSCAR_LIMITE_POR_DEFECTO,
  BUSCAR_MIN_CARACTERES,
} from "@/lib/buscar";
import { EventCard } from "@/lib/shared";
import { JsonLd, breadcrumbJsonLd } from "@/lib/seo";

export const revalidate = 300;

type PageProps = {
  searchParams: Promise<{ q?: string; pagina?: string }>;
};

const POR_PAGINA = BUSCAR_LIMITE_POR_DEFECTO;

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { q } = await searchParams;
  const consulta = (q || "").trim();

  // Una página de resultados no se indexa, y no por `noindex` sino por canonical
  // a sí misma sin consulta: hay infinitas variantes de "?q=" y todas competirían
  // entre sí por la misma intention de búsqueda. La agenda indexable de la web es
  // `/agenda/[mes]` y `/evento/[slug]`, no esto.
  return {
    title: consulta ? `Buscar: ${consulta}` : "Buscar en la agenda",
    description:
      "Busca entre todos los eventos de Vitoria-Gasteiz: conciertos, teatro, exposiciones, deporte, Senderismo y planes familiares.",
    robots: { index: false, follow: true },
    alternates: { canonical: "/buscar" },
  };
}

function paginaDe(num: string | undefined): number {
  const n = Number(num);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

export default async function BuscarPage({ searchParams }: PageProps) {
  const { q, pagina } = await searchParams;
  const consulta = (q || "").trim();
  const n = paginaDe(pagina);

  const suficiente = consulta.length >= BUSCAR_MIN_CARACTERES;
  const { results, total } = suficiente
    ? await buscarAgenda(consulta, { limit: POR_PAGINA, offset: (n - 1) * POR_PAGINA })
    : { results: [], total: 0 };

  const ultimaPagina = Math.max(1, Math.ceil(total / POR_PAGINA));
  const paginaValida = n <= ultimaPagina;
  const urlPagina = (nueva: number) =>
    `/buscar?q=${encodeURIComponent(consulta)}${nueva > 1 ? `&pagina=${nueva}` : ""}`;

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", url: "/" },
          { name: "Buscar" },
        ])}
      />

      <div className="px-5 sm:px-6 max-w-7xl mx-auto pt-28 pb-32">
        <header className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <span aria-hidden="true" className="inline-block h-5 w-[3px] rounded-full bg-accent" />
            <span className="font-display italic text-accent text-sm">Búsqueda</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl text-fg mb-3 tracking-[-0.02em]">
            {consulta ? `Resultados para "${consulta}"` : "Buscar en la agenda"}
          </h1>

          {/*
            Un `<form>` de verdad, con `action` y `method`, y no un `onSubmit`. La
            página se renderiza en el servidor, así que la búsqueda no necesita
            JavaScript para funcionar: entra alguien con ?q=jazz y ve jazz, y el
            campo de texto es un `<input name="q">` normal. El desplegable de la
            cabecera sigue siendo el cliente rápido, y esta es la página de
            resultados a la que su enlace "ver todos" apunta.
          */}
          <form action="/buscar" method="get" role="search" className="mt-6 max-w-xl">
            <label htmlFor="q" className="sr-only">
              Buscar eventos en Vitoria-Gasteiz
            </label>
            <div className="flex items-center gap-2">
              <input
                id="q"
                name="q"
                type="search"
                defaultValue={consulta}
                placeholder="Jazz, senderismo, cenas, VAM…"
                autoComplete="off"
                className="flex-1 px-4 py-3 rounded-full bg-surface border border-border text-fg placeholder:text-fg-subtle focus:outline-2 focus:outline-accent"
              />
              <button
                type="submit"
                className="px-5 py-3 rounded-full bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors"
              >
                Buscar
              </button>
            </div>
          </form>

          {suficiente && paginaValida && (
            <p className="text-fg-muted mt-5" aria-live="polite">
              {total === 0
                ? `Ningún evento casa con "${consulta}".`
                : total === 1
                  ? "1 evento encontrado."
                  : `${total} eventos encontrados, mostrando ${results.length}.`}
            </p>
          )}
        </header>

        {!consulta ? (
          <div className="rounded-2xl border border-border bg-surface p-10 text-center">
            <p className="font-display text-xl text-fg mb-2">Escribe algo para buscar</p>
            <p className="text-fg-muted text-sm mb-6">
              Buscamos en las 28 fuentes de la agenda: Ayuntamiento, VAM, Euskadi, salas
              y plataformas de entradas.
            </p>
            <Link
              href="/"
              className="inline-flex px-5 py-2.5 rounded-full bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors"
            >
              Ver la agenda
            </Link>
          </div>
        ) : !paginaValida ? (
          <div className="rounded-2xl border border-border bg-surface p-10 text-center">
            <p className="font-display text-xl text-fg mb-2">Esa página no existe</p>
            <p className="text-fg-muted text-sm mb-6">
              Hay {ultimaPagina} {ultimaPagina === 1 ? "página" : "páginas"} de resultados.
            </p>
            <Link
              href={urlPagina(1)}
              className="inline-flex px-5 py-2.5 rounded-full bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors"
            >
              Ir a la primera
            </Link>
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-10 text-center">
            <p className="font-display text-xl text-fg mb-2">Sin resultados</p>
            <p className="text-fg-muted text-sm mb-6">
              Prueba con menos palabras, con el nombre de la sala, o con el tipo de plan:
              Jazz, Montehermoso,Landaberde, senderismo, VAM.
            </p>
            <Link
              href="/"
              className="inline-flex px-5 py-2.5 rounded-full bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors"
            >
              Ver la agenda
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {results.map((hit) => (
                <EventCard
                  key={hit.slug}
                  evento={{ ...hit, category: hit.category || "Otros" }}
                />
              ))}
            </div>

            {ultimaPagina > 1 && (
              <nav
                aria-label="Páginas de resultados"
                className="flex items-center gap-3 mt-12"
              >
                {n > 1 && (
                  <Link
                    href={urlPagina(n - 1)}
                    rel="prev"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-bg-muted border border-border text-sm text-fg-muted hover:text-fg hover:border-accent/30 transition-all duration-300"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 4l-6 6 6 6" />
                    </svg>
                    Anterior
                  </Link>
                )}
                <span className="ml-auto font-mono text-xs uppercase tracking-[0.15em] text-fg-subtle">
                  Página {n} de {ultimaPagina}
                </span>
                {n < ultimaPagina && (
                  <Link
                    href={urlPagina(n + 1)}
                    rel="next"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-bg-muted border border-border text-sm text-fg-muted hover:text-fg hover:border-accent/30 transition-all duration-300"
                  >
                    Siguiente
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 4l6 6-6 6" />
                    </svg>
                  </Link>
                )}
              </nav>
            )}
          </>
        )}
      </div>
    </>
  );
}
