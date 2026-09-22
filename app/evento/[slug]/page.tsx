import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getEventoBySlug } from "@/lib/agenda";
import {
  JsonLd,
  SITE_NAME,
  breadcrumbJsonLd,
  eventDisplayDate,
  eventToJsonLd,
} from "@/lib/seo";
import { sourceLabel } from "@/lib/utils";
import { EventCard } from "@/lib/shared";
import AddToCalendar from "@/app/components/AddToCalendar";
import FavoriteButton from "@/app/components/FavoriteButton";
import ShareButton from "@/app/components/ShareButton";

export const revalidate = 300;

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getEventoBySlug(slug);
  if (!result) return { title: "Evento no encontrado" };

  const { evento } = result;
  const fecha = eventDisplayDate(evento);
  const lugar = evento.location === "Vitoria-Gasteiz"
    ? "Vitoria-Gasteiz"
    : `${evento.location}, Vitoria-Gasteiz`;
  const description = `${evento.title} · ${fecha} en ${lugar}.${
    evento.description ? ` ${evento.description}` : ""
  }`
    .slice(0, 158)
    .trim();

  return {
    title: `${evento.title} · ${fecha.split(" · ")[0]}`,
    description,
    alternates: {
      canonical: `/evento/${evento.slug}`,
    },
    openGraph: {
      type: "article",
      locale: "es_ES",
      title: evento.title,
      description,
    },
  };
}

function CalendarIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="2.5" y="4" width="15" height="13" rx="2" />
      <path d="M2.5 8h15M6.5 2.5V5M13.5 2.5V5" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg className="w-4 h-4 shrink-0 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 14.9l-5.3 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 11l8-8M5 3h6v6" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 18s-6-5.1-6-9.5A6 6 0 0110 2.5a6 6 0 016 6C16 12.9 10 18 10 18z" />
      <circle cx="10" cy="8.5" r="2" />
    </svg>
  );
}

export default async function EventoDetallePage({ params }: PageProps) {
  const { slug } = await params;
  const result = await getEventoBySlug(slug);
  if (!result) notFound();

  const { evento, related } = result;
  const eventLd = eventToJsonLd(evento);
  if (!eventLd) notFound();
  const fecha = eventDisplayDate(evento);
  const lugar = evento.location === "Vitoria-Gasteiz"
    ? "Vitoria-Gasteiz"
    : `${evento.location}, Vitoria-Gasteiz`;
  const parrafos = (evento.description || "")
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const ratingStr = typeof evento.rating === "number"
    ? evento.rating.toFixed(1).replace(".", ",")
    : null;
  const endDate = evento.dateEnd ? new Date(evento.dateEnd) : null;
  const fechaFin = endDate && !isNaN(endDate.getTime())
    ? endDate.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <>
      <JsonLd data={eventLd} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", url: "/" },
          { name: "Agenda", url: "/culture" },
          { name: evento.title },
        ])}
      />

      <article className="px-5 sm:px-6 pt-28 pb-44 md:pt-32 md:pb-24">
        <div className="max-w-3xl mx-auto">
          <nav aria-label="Migas de pan" className="mb-6 flex items-center gap-2 text-xs font-mono uppercase tracking-[0.15em] text-fg-subtle">
            <Link href="/" className="hover:text-accent transition-colors">
              Inicio
            </Link>
            <span aria-hidden="true">/</span>
            <Link href="/culture" className="hover:text-accent transition-colors">
              Agenda
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-fg-muted truncate max-w-[50vw]">{evento.title}</span>
          </nav>

          <div className="rounded-2xl overflow-hidden border border-border mb-8 aspect-video relative bg-accent-subtle">
            {evento.image ? (
              <Image
                src={evento.image}
                alt={evento.title}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 768px"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-display text-7xl text-accent/20">
                  {evento.title.charAt(0)}
                </span>
              </div>
            )}
          </div>

          {evento.category && (
            <div className="flex items-center gap-2 mb-3">
              <span aria-hidden="true" className="inline-block h-5 w-[3px] rounded-full bg-accent" />
              <span className="font-display italic text-accent text-sm">{evento.category}</span>
            </div>
          )}

          <h1 className="font-display text-3xl md:text-4xl font-semibold text-fg leading-tight tracking-[-0.02em] mb-5">
            {evento.title}
          </h1>

          {(ratingStr || evento.price) && (
            <div className="flex flex-wrap items-center gap-3 mb-6">
              {evento.price && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent-soft px-3.5 py-1.5 font-display text-sm font-semibold text-accent">
                  {evento.price}
                </span>
              )}
              {ratingStr && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 font-mono text-sm text-fg">
                  <StarIcon />
                  {ratingStr}
                </span>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2.5 mb-8 text-sm text-fg-muted">
            <p className="flex items-center gap-2.5">
              <CalendarIcon />
              <time dateTime={new Date(evento.date).toISOString()}>{fecha}</time>
            </p>
            {fechaFin && (
              <p className="flex items-center gap-2.5">
                <CalendarIcon />
                <span>Hasta el {fechaFin}</span>
              </p>
            )}
            <p className="flex items-center gap-2.5">
              <PinIcon />
              <span>{lugar}</span>
            </p>
          </div>

          <div className="mb-8">
            <div className="flex flex-wrap items-center gap-3">
              <AddToCalendar
                title={evento.title}
                date={evento.date}
                dateEnd={evento.dateEnd}
                time={evento.time}
                location={lugar}
                slug={evento.slug}
              />
              <FavoriteButton
                event={{
                  id: evento.id,
                  title: evento.title,
                  date: evento.date,
                  image: evento.image,
                  location: evento.location,
                  link: evento.link,
                }}
              />
              <ShareButton
                title={evento.title}
                slug={evento.slug}
                location={evento.location}
              />
            </div>
          </div>

          {parrafos.length > 0 && (
            <div className="prose-like space-y-4 text-base leading-relaxed text-fg-muted mb-10">
              {parrafos.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          )}

          {evento.link && (
            <div className="rounded-2xl border border-border bg-surface p-5 md:p-6 mb-10">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span aria-hidden="true" className="inline-block h-4 w-[3px] rounded-full bg-accent-subtle" />
                    <span className="font-display italic text-fg-subtle text-sm">Información y entradas</span>
                  </div>
                  <p className="font-display text-xl font-semibold text-fg">
                    {evento.price || "Acceso al evento"}
                  </p>
                </div>
                <a
                  href={evento.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-accent text-white font-semibold hover:bg-accent-hover transition-colors duration-300 active:scale-[0.98]"
                >
                  Más información y entradas
                  <ExternalIcon />
                </a>
              </div>
              {evento.source && (
                <p className="mt-4 pt-4 border-t border-border font-mono text-xs text-fg-subtle uppercase tracking-[0.15em]">
                  Fuente: {sourceLabel(evento.source)}
                </p>
              )}
            </div>
          )}

          {related.length > 0 && (
            <section className="mt-14">
              <h2 className="font-display text-xl md:text-2xl text-fg font-semibold tracking-[-0.02em] mb-6">
                También te puede interesar
              </h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {related.slice(0, 3).map((ev) => (
                  <EventCard key={ev.slug} evento={ev} showCategory categoryColors={{}} />
                ))}
              </div>
            </section>
          )}
        </div>
      </article>

      <footer className="pb-16 px-5 text-center">
        <Link
          href="/culture"
          className="inline-flex items-center gap-2 text-sm font-mono uppercase tracking-[0.15em] text-fg-subtle hover:text-accent transition-colors"
        >
          Ver agenda completa de Vitoria-Gasteiz
        </Link>
        <p className="sr-only">{SITE_NAME}</p>
      </footer>

      {evento.link && (
        <div className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom,0px)+0.75rem)] z-[var(--z-toast)] px-4 md:hidden">
          <div className="mx-auto max-w-md rounded-2xl border border-border/60 bg-fg text-bg shadow-2xl shadow-black/30 p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="font-display italic text-bg/70 text-sm font-medium">Entradas</span>
              <p className="font-display text-base font-semibold truncate">{evento.price || "Ver evento"}</p>
            </div>
            <a
              href={evento.link}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-full text-sm font-semibold active:scale-[0.97] transition-transform duration-200"
            >
              Más información
              <ExternalIcon />
            </a>
          </div>
        </div>
      )}
    </>
  );
}
