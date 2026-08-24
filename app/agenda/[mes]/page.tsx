import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAgendaEventos } from "@/lib/agenda";
import { JsonLd, breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo";

export const revalidate = 300;

const MEJES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function parseMes(mes: string): { year: number; month: number } | null {
  const match = mes.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (!match) return null;
  return { year: parseInt(match[1]), month: parseInt(match[2]) };
}

function mesLabel(year: number, month: number): string {
  const nombre = MEJES[month - 1];
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${year}`;
}

function monthUrl(year: number, month: number): string {
  return `/agenda/${year}-${String(month).padStart(2, "0")}`;
}

type PageProps = {
  params: Promise<{ mes: string }>;
};

export async function generateStaticParams() {
  const hoy = new Date();
  const months = [];
  for (let i = 0; i < 3; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
    months.push({
      mes: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    });
  }
  return months;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { mes } = await params;
  const parsed = parseMes(mes);
  if (!parsed) return { title: "Agenda no encontrada" };

  const label = mesLabel(parsed.year, parsed.month);
  return {
    title: `Eventos en Vitoria-Gasteiz — ${label}`,
    description: `Toda la agenda de Vitoria-Gasteiz en ${label}: conciertos, teatro, exposiciones, deporte, cine y planes familiares. Fechas, lugares y entradas.`,
    alternates: { canonical: `/agenda/${mes}` },
  };
}

export default async function AgendaMesPage({ params }: PageProps) {
  const { mes } = await params;
  const parsed = parseMes(mes);
  if (!parsed) notFound();

  const { year, month } = parsed;

  const todos = await getAgendaEventos({ includePast: true });
  const eventos = todos
    .filter((ev) => {
      const d = new Date(ev.date);
      return (
        d.getFullYear() === year &&
        d.getMonth() + 1 === month &&
        d >= new Date(new Date().setHours(0, 0, 0, 0))
      );
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const prevDate = new Date(year, month - 2, 1);
  const nextDate = new Date(year, month, 1);
  const prev = { url: monthUrl(prevDate.getFullYear(), prevDate.getMonth() + 1), label: mesLabel(prevDate.getFullYear(), prevDate.getMonth() + 1) };
  const next = { url: monthUrl(nextDate.getFullYear(), nextDate.getMonth() + 1), label: mesLabel(nextDate.getFullYear(), nextDate.getMonth() + 1) };

  const porDia = new Map<string, typeof eventos>();
  for (const ev of eventos) {
    const key = new Date(ev.date).toISOString().slice(0, 10);
    if (!porDia.has(key)) porDia.set(key, []);
    porDia.get(key)!.push(ev);
  }

  return (
    <>
      <JsonLd
        data={itemListJsonLd(
          eventos.slice(0, 50),
          `Eventos en Vitoria-Gasteiz — ${mesLabel(year, month)}`,
          `/agenda/${mes}`
        )}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", url: "/" },
          { name: "Agenda", url: "/culture" },
          { name: mesLabel(year, month) },
        ])}
      />

      <div className="px-5 sm:px-6 max-w-7xl mx-auto pt-28 pb-32">
        <header className="mb-10">
          <p className="font-mono text-xs tracking-[0.2em] uppercase text-accent mb-3">
            Archivo · Agenda
          </p>
          <h1 className="font-display text-4xl md:text-5xl text-fg mb-3 tracking-[-0.02em]">
            Eventos · {mesLabel(year, month)}
          </h1>
          <p className="text-fg-muted max-w-2xl">
            {eventos.length > 0
              ? `${eventos.length} eventos en Vitoria-Gasteiz durante ${mesLabel(year, month)}.`
              : `Aún no hay eventos publicados para ${mesLabel(year, month)}.`}
          </p>
        </header>

        <nav aria-label="Navegación entre meses" className="flex items-center gap-3 mb-12">
          <Link
            href={prev.url}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-bg-muted border border-border text-sm text-fg-muted hover:text-fg hover:border-accent/30 transition-all duration-300"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4l-6 6 6 6" />
            </svg>
            {prev.label}
          </Link>
          <Link
            href={next.url}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-bg-muted border border-border text-sm text-fg-muted hover:text-fg hover:border-accent/30 transition-all duration-300 ml-auto"
          >
            {next.label}
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 4l6 6-6 6" />
            </svg>
          </Link>
        </nav>

        {eventos.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-10 text-center">
            <p className="font-display text-xl text-fg mb-2">Sin eventos este mes</p>
            <p className="text-fg-muted text-sm mb-6">
              Publicamos nuevos eventos a diario. Consulta el mes siguiente o la agenda completa.
            </p>
            <Link
              href="/culture"
              className="inline-flex px-5 py-2.5 rounded-full bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors"
            >
              Ver agenda completa
            </Link>
          </div>
        ) : (
          <div className="space-y-12">
            {[...porDia.entries()].map(([dia, evs]) => {
              const fecha = new Date(dia + "T12:00:00");
              const label = fecha.toLocaleDateString("es-ES", {
                weekday: "long",
                day: "numeric",
                month: "long",
              });
              return (
                <section key={dia}>
                  <h2 className="font-display text-lg md:text-xl text-fg font-bold tracking-[-0.01em] capitalize mb-5 flex items-center gap-3">
                    {label}
                    <span className="h-px flex-1 bg-border" aria-hidden="true" />
                    <span className="font-mono text-xs text-fg-subtle font-normal">
                      {evs.length}
                    </span>
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {evs.map((ev) => {
                      const d = new Date(ev.date);
                      const validDate = !isNaN(d.getTime());
                      return (
                        <Link
                          key={ev.slug}
                          href={`/evento/${ev.slug}`}
                          className="group double-bezel-outer rounded-[1.25rem] p-1.5 block focus-visible:outline-2 focus-visible:outline-accent transition-all duration-500 hover:shadow-lg hover:shadow-accent/5"
                        >
                          <div className="double-bezel rounded-[calc(1.25rem-0.375rem)] overflow-hidden">
                            <div className="aspect-[4/3] relative bg-accent-subtle flex items-center justify-center">
                              <div className="text-center">
                                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent mb-1">
                                  {validDate
                                    ? new Intl.DateTimeFormat("es", { month: "short" }).format(d).toUpperCase().replace(".", "")
                                    : "···"}
                                </p>
                                <p className="font-display text-6xl font-black text-accent/40 leading-none transition-transform duration-[800ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105">
                                  {validDate ? d.getDate() : "?"}
                                </p>
                              </div>
                              {ev.time && (
                                <span className="absolute bottom-3 right-4 font-mono text-xs text-fg-subtle tabular-nums">
                                  {ev.time}
                                </span>
                              )}
                            </div>
                            <div className="p-4">
                              {ev.category && (
                                <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-accent mb-1.5">
                                  {ev.category}
                                </p>
                              )}
                              <h3 className="font-display text-base font-semibold text-fg leading-snug line-clamp-2">
                                {ev.title}
                              </h3>
                              <p className="font-mono text-xs text-fg-subtle mt-2">{ev.location}</p>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
