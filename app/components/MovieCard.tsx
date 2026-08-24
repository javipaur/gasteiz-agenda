import Image from "next/image";

type Pelicula = {
  titulo: string;
  duracion: string;
  genero: string;
  imagen: string;
  link: string;
  horarios: string[];
  cine: string;
};

const CINE_COLORS: Record<string, string> = {
  Florida: "bg-accent",
  Boulevard: "bg-fg",
};

function formatDate() {
  const d = new Date();
  return {
    day: d.getDate(),
    month: new Intl.DateTimeFormat("es", { month: "short" }).format(d).toUpperCase().replace(".", ""),
  };
}

function TicketIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 4.5h14v7H1z" />
      <path d="M5.5 6v4M8 6v4M10.5 6v4" />
    </svg>
  );
}

export default function MovieCard({ pelicula }: { pelicula: Pelicula }) {
  const badgeColor = CINE_COLORS[pelicula.cine] || "bg-fg-muted";

  return (
    <a
      href={pelicula.link}
      target="_blank"
      rel="noopener noreferrer"
      className="group double-bezel-outer rounded-[1.25rem] p-1.5 block focus-visible:outline-2 focus-visible:outline-accent"
    >
      <div className="double-bezel rounded-[calc(1.25rem-0.375rem)] overflow-hidden">
        <div className="aspect-[4/3] relative">
          <Image
            src={pelicula.imagen}
            alt={pelicula.titulo}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-[800ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

          <div className="absolute top-3 left-3 bg-white/15 backdrop-blur-xl rounded-xl px-2.5 py-1.5 text-center leading-tight"
            style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)' }}>
            <span className="block font-mono text-[11px] uppercase text-white/70">
              HOY
            </span>
            <span className="block font-display text-lg text-white">
              <TicketIcon className="w-4 h-4 inline" />
            </span>
          </div>

          <div className={`absolute top-3 right-3 ${badgeColor} text-white text-[11px] font-mono uppercase tracking-wider px-2.5 py-1`}
            style={{ borderRadius: '6px' }}>
            {pelicula.cine}
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="font-display text-base font-semibold text-white leading-snug mb-1 line-clamp-2">
              {pelicula.titulo}
            </h3>
            <p className="font-mono text-xs text-white/70 line-clamp-1">
              {pelicula.genero}{pelicula.duracion ? ` · ${pelicula.duracion}` : ""}
            </p>
          </div>
        </div>

        <div className="p-4 bg-surface">
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-fg-muted mb-2">
            Horarios
          </p>
          <div className="flex flex-wrap gap-1.5">
            {pelicula.horarios.map((hora, i) => (
              <span
                key={i}
                className="px-2.5 py-1.5 bg-bg-muted rounded-lg font-mono text-xs text-fg-muted font-medium"
              >
                {hora}
              </span>
            ))}
          </div>
          <div className="mt-4 bg-accent text-white text-center py-3 font-medium text-sm hover:bg-accent-hover transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] flex items-center justify-center gap-2"
            style={{ borderRadius: '999px' }}>
            <span>Comprar entradas</span>
            <TicketIcon className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </a>
  );
}
