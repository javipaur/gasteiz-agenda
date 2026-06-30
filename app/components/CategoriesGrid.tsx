import Link from "next/link";
import { Film, Palette, Activity, Sparkles } from "lucide-react";

const categories = [
  {
    label: "Cine",
    href: "/movies",
    desc: "Cartelera y festivales",
    icon: Film,
  },
  {
    label: "Cultura",
    href: "/culture",
    desc: "Teatro, conciertos, arte",
    icon: Palette,
  },
  {
    label: "Deporte",
    href: "/deporte",
    desc: "Running, trail, eventos",
    icon: Activity,
  },
  {
    label: "Kids",
    href: "/kids",
    desc: "Planes familiares",
    icon: Sparkles,
  },
];

export default function CategoriesGrid() {
  return (
    <section className="px-6 py-16 md:py-24 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <h2 className="font-display text-3xl md:text-4xl text-ink font-bold">
          Explora
        </h2>
        <span className="h-px flex-1 bg-stone" aria-hidden="true" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        {categories.map((cat) => (
          <Link
            key={cat.href}
            href={cat.href}
            className="group flex flex-col items-start gap-3 p-6 bg-white rounded-xl border border-stone transition-all hover:border-ink/20 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-red"
          >
            <cat.icon className="w-6 h-6 text-green group-hover:text-red transition-colors" />
            <div>
              <h3 className="font-display text-lg font-semibold text-ink group-hover:text-red transition-colors">
                {cat.label}
              </h3>
              <p className="text-sm text-ink-light mt-0.5">{cat.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
