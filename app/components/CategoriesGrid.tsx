import Link from "next/link";

function FilmIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="3" />
      <path d="M7 2v20M17 2v20M2 7h20M2 12h20M2 17h20" />
    </svg>
  );
}

function PaletteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    </svg>
  );
}

function ActivityIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z" />
      <path d="M19 17l-.5 2L17 19.5 19 20l.5 2 .5-2L22 19.5 20.5 19z" />
      <path d="M5 3l-.5 2L3 5.5 5 6l.5 2 .5-2L8 5.5 6.5 5z" />
    </svg>
  );
}

const categories = [
  {
    label: "Cine",
    href: "/movies",
    desc: "Cartelera y festivales",
    icon: FilmIcon,
    color: "text-blue",
    bgColor: "bg-blue/5",
  },
  {
    label: "Cultura",
    href: "/culture",
    desc: "Teatro, conciertos, arte",
    icon: PaletteIcon,
    color: "text-accent",
    bgColor: "bg-accent-soft",
  },
  {
    label: "Deporte",
    href: "/deporte",
    desc: "Running, trail, eventos",
    icon: ActivityIcon,
    color: "text-green",
    bgColor: "bg-green/5",
  },
  {
    label: "Kids",
    href: "/kids",
    desc: "Planes familiares",
    icon: SparklesIcon,
    color: "text-teal",
    bgColor: "bg-teal/5",
  },
];

export default function CategoriesGrid() {
  return (
    <section className="px-4 py-16 md:py-24 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <h2 className="font-display text-3xl md:text-4xl text-fg font-bold tracking-[-0.02em]">
          Explora
        </h2>
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
        {categories.map((cat) => (
          <Link
            key={cat.href}
            href={cat.href}
            className="group double-bezel-outer rounded-[1.25rem] p-1.5 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:outline-accent/20"
          >
            <div className="double-bezel rounded-[calc(1.25rem-0.375rem)] p-5 md:p-6 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:bg-surface-hover">
              <div className={`w-10 h-10 rounded-xl ${cat.bgColor} flex items-center justify-center mb-4 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105`}>
                <cat.icon className={`w-5 h-5 ${cat.color}`} />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold text-fg group-hover:text-accent transition-colors duration-300">
                  {cat.label}
                </h3>
                <p className="text-sm text-fg-muted mt-1 leading-relaxed">{cat.desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
