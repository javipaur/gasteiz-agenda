import Link from "next/link";
import { getProximosPartidos } from "@/lib/partidos";
import type { Partido } from "@/lib/sources/clubCms";

function formatearDia(fecha: string | null): string {
  if (!fecha) return "Fecha por confirmar";
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return "Fecha por confirmar";
  return new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short" }).format(d);
}

function RowPartido({ partido, index }: { partido: Partido; index: number }) {
  return (
    <li className="flex items-center gap-3 py-3 border-b border-border">
      <span className="font-mono text-xs text-fg-subtle w-5">{index + 1}</span>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {partido.local.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={partido.local.url} alt={partido.local.nombre} className="h-6 w-6 object-contain shrink-0" />
        )}
        <span className="text-sm truncate">{partido.local.nombre}</span>
        <span className="text-xs text-fg-subtle">vs</span>
        <span className="text-sm truncate">{partido.visitante.nombre}</span>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold">{formatearDia(partido.fecha)}</p>
        <p className="text-xs text-fg-subtle">
          {partido.hora ? partido.hora.slice(0, 5) : "Hora por confirmar"} · {partido.competicion}
        </p>
      </div>
    </li>
  );
}

export default async function ProMatchesBlock() {
  const partidos = await getProximosPartidos(3);
  if (partidos.length === 0) return null;

  return (
    <section aria-label="Partidos pro" className="px-5 sm:px-6 py-10 md:py-14 max-w-7xl mx-auto">
      <div className="flex items-end justify-between gap-4 flex-wrap mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-sec-green mb-2">Deporte · Profesional</p>
          <h2 className="text-2xl md:text-3xl font-semibold text-fg">Partidos de los nuestros</h2>
        </div>
        <Link href="/deporte" className="text-sm font-semibold text-accent hover:underline whitespace-nowrap">
          Agenda deportiva →
        </Link>
      </div>
      <ul className="double-bezel rounded-2xl px-4">
        {partidos.map((p, i) => (
          <RowPartido key={p.id} partido={p} index={i} />
        ))}
      </ul>
    </section>
  );
}