import type { Metadata } from "next";
import Link from "next/link";
import { getGazteFilmFest2026Programa } from "@/lib/archived-events";
import { agruparPorDiaLocal } from "@/lib/agenda";
import { JsonLd, breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo";

export const revalidate = 300;

const DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function formatDayHeading(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const diaSemana = DIAS_SEMANA[date.getDay()];
  return `${diaSemana.charAt(0).toUpperCase()}${diaSemana.slice(1)} ${d} de ${MESES[m - 1]}`;
}

export const metadata: Metadata = {
  title: "Programa Gazte Film Fest 2026 en Vitoria-Gasteiz",
  description:
    "Programa completo por días de Gazte Film Fest 2026 en Vitoria-Gasteiz: sesiones, horarios, sedes y enlaces a cada proyección y actividad del festival.",
  alternates: { canonical: "/gazte-film-fest-2026" },
  openGraph: {
    title: "Programa Gazte Film Fest 2026 en Vitoria-Gasteiz",
    description:
      "Todas las sesiones de Gazte Film Fest 2026 organizadas por día, con horarios y sedes en Vitoria-Gasteiz.",
    type: "article",
    locale: "es_ES",
  },
};

export default function GazteFilmFest2026Page() {
  const { festival, sesiones } = getGazteFilmFest2026Programa();
  const porDia = agruparPorDiaLocal(sesiones);
  const dias = [...porDia.entries()];

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Inicio", url: "/" },
          { name: "Agenda", url: "/culture" },
          { name: festival.title, url: `/evento/${festival.slug}` },
          { name: "Programa 2026" },
        ])}
      />
      <JsonLd
        data={itemListJsonLd(
          sesiones.map((ev) => ({
            slug: ev.slug,
            title: ev.title,
            date: ev.date,
            time: ev.time,
            image: ev.image,
            location: ev.location,
            link: ev.link,
            description: ev.description,
            category: ev.category,
            price: ev.price,
            officialUrl: ev.officialUrl,
          })),
          "Programa Gazte Film Fest 2026 en Vitoria-Gasteiz",
          "/gazte-film-fest-2026"
        )}
      />

      <article className="px-5 sm:px-6 pt-28 pb-24 md:pt-32">
        <div className="max-w-4xl mx-auto">
          <nav aria-label="Migas de pan" className="mb-6 flex flex-wrap items-center gap-2 text-xs font-mono uppercase tracking-[0.15em] text-fg-subtle">
            <Link href="/" className="hover:text-accent transition-colors">Inicio</Link>
            <span aria-hidden="true">/</span>
            <Link href="/culture" className="hover:text-accent transition-colors">Agenda</Link>
            <span aria-hidden="true">/</span>
            <Link href={`/evento/${festival.slug}`} className="hover:text-accent transition-colors">Festival</Link>
            <span aria-hidden="true">/</span>
            <span className="text-fg-muted">Programa</span>
          </nav>

          <div className="inline-flex items-center gap-2 mb-4">
            <span aria-hidden="true" className="inline-block h-5 w-[3px] rounded-full bg-accent" />
            <span className="font-display italic text-accent text-sm">Festival de cine infantil · Vitoria-Gasteiz</span>
          </div>

          <h1 className="font-display text-3xl md:text-5xl font-semibold text-fg leading-tight tracking-[-0.02em] mb-4">
            Programa de Gazte Film Fest 2026
          </h1>
          <p className="text-base md:text-lg leading-relaxed text-fg-muted max-w-2xl mb-8">
            Sesiones, proyecciones y actividades del 19 al 29 de noviembre de 2026 en Vitoria-Gasteiz.
            Cada sesión aparece también en la agenda y tiene su propia ficha con horario, sede y enlace.
          </p>

          <div className="flex flex-wrap gap-3 mb-8">
            <Link
              href={`/evento/${festival.slug}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-border bg-surface text-sm font-medium text-fg hover:border-accent/40 hover:text-accent transition-colors"
            >
              Ver ficha del festival
            </Link>
            <a
              href="https://www.gaztefilmfest.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors"
            >
              Web oficial del festival
            </a>
          </div>

          {dias.length > 0 && (
            <nav aria-label="Ir a un día del programa" className="mb-12">
              <p className="font-mono text-xs uppercase tracking-[0.15em] text-fg-subtle mb-3">
                Programa por días
              </p>
              <ul className="flex flex-wrap gap-2">
                {dias.map(([ymd, eventos]) => {
                  const [, m, d] = ymd.split("-");
                  return (
                    <li key={ymd}>
                      <a
                        href={`#dia-${ymd}`}
                        className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-2 text-sm text-fg-muted hover:text-accent hover:border-accent/40 transition-colors"
                      >
                        <span className="font-medium text-fg">{Number(d)}/{m}</span>
                        <span className="font-mono text-xs text-fg-subtle">
                          {eventos.length} {eventos.length === 1 ? "sesión" : "sesiones"}
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>
          )}

          <div className="space-y-10">
            {dias.map(([ymd, eventos]) => (
              <section key={ymd} aria-labelledby={`dia-${ymd}`}>
                <h2 id={`dia-${ymd}`} className="font-display text-2xl md:text-3xl font-semibold text-fg tracking-[-0.02em] mb-1 scroll-mt-28">
                  {formatDayHeading(ymd)}
                </h2>
                <p className="text-sm font-mono text-fg-subtle mb-4">
                  {eventos.length} {eventos.length === 1 ? "sesión" : "sesiones"}
                </p>
                <ul className="space-y-3">
                  {eventos.map((ev) => (
                    <li key={ev.slug}>
                      <Link
                        href={`/evento/${ev.slug}`}
                        className="group block rounded-xl border border-border bg-surface p-4 md:p-5 hover:border-accent/40 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
                          <div className="min-w-0">
                            <p className="font-display text-lg font-semibold text-fg group-hover:text-accent transition-colors">
                              {ev.title}
                            </p>
                            <p className="mt-1 text-sm text-fg-muted">
                              {ev.location === "Vitoria-Gasteiz" ? "Vitoria-Gasteiz" : ev.location}
                            </p>
                          </div>
                          <div className="shrink-0 flex flex-wrap items-center gap-2 text-sm font-mono text-fg-subtle">
                            {ev.time && <span>{ev.time}</span>}
                            {ev.category && ev.category !== "Cine" && (
                              <span className="rounded-full border border-border px-2 py-0.5 text-[11px] uppercase tracking-[0.12em]">
                                {ev.category}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          {dias.length === 0 && (
            <p className="text-fg-muted">No hay sesiones disponibles en este momento.</p>
          )}

          <p className="mt-12 text-sm text-fg-subtle">
            Programa contrastado desde la web oficial del festival. La información puede cambiar; consulta la fuente para actualizaciones de última hora.
          </p>
        </div>
      </article>
    </>
  );
}
