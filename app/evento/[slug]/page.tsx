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
  const description = `${evento.title} — ${fecha} en ${lugar}.${
    evento.description ? ` ${evento.description}` : ""
  }`
    .slice(0, 158)
    .trim();

  return {
    title: `${evento.title} — ${fecha.split(" · ")[0]}`,
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

      <article className="px-5 sm:px-6 pt-28 pb-24 md:pt-32">
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
            <p className="font-mono text-[11px] tracking-[0.2em] uppercase text-accent mb-3">
              {evento.category}
            </p>
          )}

          <h1 className="font-display text-3xl md:text-4xl font-bold text-fg leading-tight tracking-[-0.02em] mb-5">
            {evento.title}
          </h1>

          <div className="flex flex-col gap-2.5 mb-8 text-sm text-fg-muted">
            <p className="flex items-center gap-2.5">
              <CalendarIcon />
              <time dateTime={new Date(evento.date).toISOString()}>{fecha}</time>
            </p>
            <p className="flex items-center gap-2.5">
              <PinIcon />
              <span>{lugar}</span>
            </p>
          </div>

          <div className="mb-8">
            <AddToCalendar
              title={evento.title}
              date={evento.date}
              dateEnd={evento.dateEnd}
              time={evento.time}
              location={lugar}
              slug={evento.slug}
            />
          </div>

          {parrafos.length > 0 && (
            <div className="prose-like space-y-4 text-base leading-relaxed text-fg-muted mb-10">
              {parrafos.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          )}

          {evento.link && (
            <div className="flex flex-wrap items-center gap-4 mb-10">
              <a
                href={evento.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-accent text-white font-semibold hover:bg-accent-hover transition-colors duration-300"
              >
                Más información y entradas
                <svg className="w-4 h-4" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M3 11l8-8M5 3h6v6" />
                </svg>
              </a>
              {evento.source && (
                <span className="font-mono text-xs text-fg-subtle uppercase tracking-[0.15em]">
                  Fuente: {sourceLabel(evento.source)}
                </span>
              )}
            </div>
          )}

          {related.length > 0 && (
            <section className="mt-14">
              <h2 className="font-display text-xl md:text-2xl text-fg font-bold tracking-[-0.02em] mb-6">
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
    </>
  );
}
