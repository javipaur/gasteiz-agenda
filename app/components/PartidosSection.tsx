import Link from "next/link";
import { getProximosPartidos } from "@/lib/partidos";
import type { Partido } from "@/lib/sources/clubCms";
import SectionHead from "./SectionHead";

const CLUB_NOMBRE: Record<string, string> = {
  baskonia: "Baskonia",
  alaves: "Alavés",
  araski: "Araski",
};

function formatearDia(fecha: string | null): string {
  if (!fecha) return "Fecha por confirmar";
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return "Fecha por confirmar";
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
}

async function PartidoCard({ partido }: { partido: Partido }) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-5 flex flex-col gap-3 card-hover h-full">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-lime">
          {CLUB_NOMBRE[partido.equipo] ?? partido.club}
        </span>
        <span className="text-xs text-fg-subtle font-mono">{formatearDia(partido.fecha)}</span>
      </div>
      <p className="text-sm text-fg-muted">{partido.competicion}</p>
      <div className="flex items-center justify-between gap-2 my-1">
        <div className="flex flex-col items-center gap-1 w-20">
          {partido.local.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={partido.local.url} alt={partido.local.nombre} className="h-9 w-9 object-contain" />
          ) : (
            <span className="h-9 w-9 rounded-full bg-surface-hover flex items-center justify-center text-xs font-bold">
              {partido.local.nombre.slice(0, 1)}
            </span>
          )}
          <span className="text-xs text-center leading-tight">{partido.local.nombre}</span>
        </div>
        <span className="text-fg-subtle font-mono text-sm">vs</span>
        <div className="flex flex-col items-center gap-1 w-20">
          {partido.visitante.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={partido.visitante.url} alt={partido.visitante.nombre} className="h-9 w-9 object-contain" />
          ) : (
            <span className="h-9 w-9 rounded-full bg-surface-hover flex items-center justify-center text-xs font-bold">
              {partido.visitante.nombre.slice(0, 1)}
            </span>
          )}
          <span className="text-xs text-center leading-tight">{partido.visitante.nombre}</span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 mt-auto">
        <span className="text-xs text-fg-subtle">{partido.estadio || "Vitoria-Gasteiz"}</span>
        <span className="text-xs font-mono text-fg-muted">{partido.hora ? partido.hora.slice(0, 5) : "Hora por confirmar"}</span>
      </div>
      {partido.link && (
        <Link href={partido.link} target="_blank" rel="noopener noreferrer"
              className="text-sm font-semibold text-lime hover:underline">
          Entradas →
        </Link>
      )}
    </article>
  );
}

export default async function PartidosSection() {
  const partidos = await getProximosPartidos(1);
  return (
    <section aria-label="Partidos de los equipos de Vitoria" className="px-5 sm:px-6 py-10 md:py-16 max-w-7xl mx-auto">
      <SectionHead
        tag="Deporte"
        title="Nuestros equipos en acción"
        subtitle="Baskonia, Alavés y Araski, sus próximas citas."
        href="/deporte"
        linkLabel="Ver agenda deportiva"
        color="var(--lime)"
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {partidos.length === 0 ? (
          <p className="text-fg-muted sm:col-span-3">No hay partidos confirmados todavía. Vuelve en unos días.</p>
        ) : (
          partidos.map((p) => <PartidoCard key={p.id} partido={p} />)
        )}
      </div>
    </section>
  );
}