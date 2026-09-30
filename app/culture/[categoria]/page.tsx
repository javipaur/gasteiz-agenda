import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCultureEventos } from "@/lib/cultura";
import { CULTURA_CATEGORIAS, CulturaCategoriaSlug } from "@/lib/categories";
import { isTicketSource } from "@/lib/tickets";
import { JsonLd, itemListJsonLd } from "@/lib/seo";

export const revalidate = 300;

type PageProps = {
  params: Promise<{ categoria: string }>;
};

function isValidCategoria(slug: string): slug is CulturaCategoriaSlug {
  return CULTURA_CATEGORIAS.some((c) => c.slug === slug);
}

function TicketIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 4.5h14v7H1z" />
      <path d="M5.5 6v4M8 6v4M10.5 6v4" />
    </svg>
  );
}

export async function generateStaticParams() {
  return CULTURA_CATEGORIAS.map((c) => ({ categoria: c.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { categoria } = await params;
  if (!isValidCategoria(categoria)) return { title: "Categoría no encontrada" };

  const label = CULTURA_CATEGORIAS.find((c) => c.slug === categoria)!.label;
  return {
    title: `${label} en Vitoria-Gasteiz · Agenda Cultural`,
    description: `${label} en Vitoria-Gasteiz: fechas, lugares y entradas. Agenda actualizada a diario con todos los eventos de ${label.toLowerCase()} en la ciudad.`,
    alternates: { canonical: `/culture/${categoria}` },
  };
}

export default async function CulturaCategoriaPage({ params }: PageProps) {
  const { categoria } = await params;
  if (!isValidCategoria(categoria)) notFound();

  const label = CULTURA_CATEGORIAS.find((c) => c.slug === categoria)!.label;

  const todos = await getCultureEventos();
  const eventos = todos
    .filter((e) => e.category === categoria)
    .filter((e) => new Date(e.date) >= new Date(new Date().setHours(0, 0, 0, 0)))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <>
      <JsonLd
        data={itemListJsonLd(
          // El slug viene resuelto en el evento: la tarjeta de abajo enlaza con
          // `evento.slug` y el detalle resuelve en el agregado, así que aquí no
          // hay nada que recalcular ni que pueda separarse de él.
          eventos.filter((e) => e.link).slice(0, 50),
          `${label} en Vitoria-Gasteiz`,
          `/culture/${categoria}`
        )}
      />

      <div className="px-5 sm:px-6 max-w-7xl mx-auto pt-28 pb-32">
        <header className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <span aria-hidden="true" className="inline-block h-5 w-[3px] rounded-full bg-accent" />
            <span className="font-display italic text-accent text-sm">Agenda cultural</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl text-fg mb-3 tracking-[-0.02em]">
            {label} en Vitoria-Gasteiz
          </h1>
          <p className="text-fg-muted max-w-2xl mb-8">
            {eventos.length > 0
              ? `${eventos.length} próximos eventos. Fechas, lugares y entradas actualizadas a diario.`
              : `No hay eventos de ${label.toLowerCase()} publicados ahora mismo. Actualizamos la agenda a diario.`}
          </p>

          <nav aria-label="Categorías" className="flex gap-2 flex-wrap">
            {CULTURA_CATEGORIAS.map((c) => (
              <Link
                key={c.slug}
                href={`/culture/${c.slug}`}
                className={`px-4 py-2 text-sm font-medium rounded-full transition-all duration-300 ${
                  c.slug === categoria
                    ? "bg-accent text-white"
                    : "bg-bg-muted text-fg-muted hover:text-fg hover:bg-border"
                }`}
              >
                {c.label}
              </Link>
            ))}
          </nav>
        </header>

        {eventos.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {eventos.slice(0, 60).map((evento) => {
              const d = new Date(evento.date);
              const fecha = isNaN(d.getTime())
                ? ""
                : d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
              return (
                <div
                  key={evento.id + evento.title}
                  className="group rounded-2xl border border-border bg-surface p-5 block hover:border-accent/40 transition-all duration-300"
                >
                  <Link
                    href={`/evento/${evento.slug}`}
                    className="block focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    {evento.category && (
                      <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-accent mb-2">
                        {evento.category}
                      </p>
                    )}
                    <h2 className="font-display text-lg font-semibold text-fg leading-snug mb-3 line-clamp-2">
                      {evento.title}
                    </h2>
                    <div className="flex items-center justify-between font-mono text-xs text-fg-subtle">
                      <span>{fecha}</span>
                      <span className="truncate max-w-[55%]">{evento.location}</span>
                    </div>
                  </Link>
                  {evento.link && (
                    <a
                      href={evento.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-[0.15em] text-accent hover:text-accent-hover transition-colors"
                    >
                      {isTicketSource(evento.source) ? "Comprar entradas" : "Más información"}
                      <TicketIcon className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-surface p-10 text-center">
            <p className="text-fg-muted text-sm">
              Consulta las otras categorías o{" "}
              <Link href="/culture" className="text-accent underline underline-offset-2">
                vuelve a la agenda cultural completa
              </Link>
              .
            </p>
          </div>
        )}
      </div>
    </>
  );
}
