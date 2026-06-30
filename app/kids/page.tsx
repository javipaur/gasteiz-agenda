import FavoriteButton from "../components/FavoriteButton";

const MONTHS = [
  "ENE", "FEB", "MAR", "ABR", "MAY", "JUN",
  "JUL", "AGO", "SEP", "OCT", "NOV", "DIC",
];

type Evento = {
  id: string;
  title: string;
  date: string;
  image?: string;
  location?: string;
  link: string;
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return {
    day: d.getDate(),
    month: MONTHS[d.getMonth()],
  };
}

export default async function KidsPage() {
  const BASE_URL = process.env.API_BASE_URL || "https://gasteizclick.javierpalacio.es";
  const res = await fetch(
    `${BASE_URL}/api/actividades/eventos/agenda/infantil`,
    { next: { revalidate: 3600 } }
  );
  const json = await res.json();
  const raw: any[] = Array.isArray(json) ? json : json.data ?? [];

  const eventos: Evento[] = raw.map((e) => ({
    id: e.id ?? crypto.randomUUID(),
    title: e.title ?? e.nombre ?? e.titulo ?? "Evento sin título",
    date: e.date ?? e.fecha ?? e.fecha_inicio ?? "",
    image:
      e.image && e.image.startsWith("http")
        ? e.image
        : e.imagen && e.imagen.startsWith("http")
          ? e.imagen
          : null,
    location: e.location ?? e.ubicacion ?? e.poblacion ?? "",
    link: e.link ?? e.url ?? "#",
  }));

  return (
    <div className="px-6 max-w-7xl mx-auto pt-24 pb-32">
      <header className="mb-12">
        <p className="font-mono text-sm tracking-widest uppercase text-vermilion mb-3">
          Familia
        </p>
        <h1 className="font-display text-4xl md:text-5xl text-moss-700 mb-3">
          Planes con Niños
        </h1>
        <p className="text-charcoal-600 max-w-2xl">
          Actividades y planes familiares en Vitoria-Gasteiz
        </p>
      </header>

      {eventos.length === 0 ? (
        <p className="text-charcoal-400 text-center py-12 font-mono text-sm">
          No hay eventos disponibles
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {eventos.map((evento, index) => {
            const { day, month } = formatDate(evento.date);
            return (
              <a
                key={evento.title + index}
                href={evento.link || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative overflow-hidden rounded-2xl block focus-visible:outline-2 focus-visible:outline-vermilion"
              >
                <div className="aspect-[4/3] relative">
                  {evento.image ? (
                    <img
                      src={evento.image}
                      alt={evento.title}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 w-full h-full bg-moss-500/30 flex items-center justify-center">
                      <span className="font-display text-6xl text-white/20">
                        {evento.title.charAt(0)}
                      </span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

                  <div className="absolute top-3 left-3 bg-white/20 backdrop-blur-sm rounded-lg px-2.5 py-1.5 text-center leading-tight">
                    <span className="block font-mono text-[11px] uppercase text-white/80">
                      {month}
                    </span>
                    <span className="block font-display text-lg text-white">
                      {day}
                    </span>
                  </div>
                  <div className="absolute top-3 right-3">
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
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="font-display text-base font-semibold text-white leading-snug mb-1.5 line-clamp-2">
                      {evento.title}
                    </h3>
                    {evento.location && (
                      <p className="font-mono text-xs text-white/70 flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-vermilion inline-block shrink-0" />
                        {evento.location}
                      </p>
                    )}
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
