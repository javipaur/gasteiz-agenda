const MONTHS = [
  "ENE", "FEB", "MAR", "ABR", "MAY", "JUN",
  "JUL", "AGO", "SEP", "OCT", "NOV", "DIC",
];

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
  Florida: "bg-vermilion",
  Boulevard: "bg-moss-700",
};

function formatDate() {
  const d = new Date();
  return {
    day: d.getDate(),
    month: MONTHS[d.getMonth()],
  };
}

export default function MovieCard({ pelicula }: { pelicula: Pelicula }) {
  const { day, month } = formatDate();
  const badgeColor = CINE_COLORS[pelicula.cine] || "bg-charcoal-600";

  return (
    <a
      href={pelicula.link}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative overflow-hidden rounded-2xl block focus-visible:outline-2 focus-visible:outline-vermilion bg-white"
    >
      <div className="aspect-[4/3] relative">
        <img
          src={pelicula.imagen}
          alt={pelicula.titulo}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

        <div className="absolute top-3 left-3 bg-white/20 backdrop-blur-sm rounded-lg px-2.5 py-1.5 text-center leading-tight">
          <span className="block font-mono text-[11px] uppercase text-white/80">
            {month}
          </span>
          <span className="block font-display text-lg text-white">
            {day}
          </span>
        </div>

        <div className={`absolute top-3 right-3 ${badgeColor} text-white text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-lg`}>
          {pelicula.cine}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="font-display text-base font-semibold text-white leading-snug mb-1">
            {pelicula.titulo}
          </h3>
          <p className="font-mono text-xs text-white/70">
            {pelicula.genero}{pelicula.duracion ? ` · ${pelicula.duracion}` : ""}
          </p>
        </div>
      </div>

      <div className="p-4 bg-white">
        <p className="font-mono text-[10px] uppercase tracking-wider text-charcoal-600 mb-2">
          Horarios
        </p>
        <div className="flex flex-wrap gap-2">
          {pelicula.horarios.map((hora, i) => (
            <span
              key={i}
              className="px-2.5 py-1.5 bg-limestone-200 rounded-lg font-mono text-xs text-charcoal-600 font-semibold"
            >
              {hora}
            </span>
          ))}
        </div>
        <div className="mt-4 bg-moss-700 text-white text-center py-3 rounded-xl font-semibold text-sm hover:bg-moss-800 transition-colors">
          Comprar entradas
        </div>
      </div>
    </a>
  );
}
