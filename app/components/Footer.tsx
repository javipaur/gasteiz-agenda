import Link from "next/link";

function FilmIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="16" height="16" rx="2" />
      <path d="M6 2v16M14 2v16M2 6h16M2 10h16M2 14h16" />
    </svg>
  );
}

function ActivityIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 10h-3l-2.5 7.5L7.5 2.5 5 10H2" />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2.5l1.25 4.25L15.5 8l-4.25 1.25L10 13.5l-1.25-4.25L4.5 8l4.25-1.25z" />
      <path d="M16 14l-.5 1.5L14 16l1.5.5.5 1.5.5-1.5L18 16l-1.5-.5z" />
      <path d="M4 4l-.5 1.5L2 6l1.5.5L4 8l.5-1.5L6 6 5.5 4.5z" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3v10M6 9l4 4 4-4" />
      <path d="M3 14v2a1 1 0 001 1h12a1 1 0 001-1v-2" />
    </svg>
  );
}

function PlayStoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 512 512" fill="currentColor">
      <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z" />
    </svg>
  );
}

export default function Footer() {
  return (
    <footer className="mt-20">
      <div className="bg-fg text-white/80">
        <div className="max-w-7xl mx-auto px-4 py-16 md:py-20 grid md:grid-cols-4 gap-10">
          <div>
            <h2 className="font-display text-2xl font-bold text-white mb-4 tracking-[-0.02em]">
              Gasteiz Click
            </h2>
            <p className="text-sm text-white/60 leading-relaxed">
              Descubre eventos, deporte y cultura en Vitoria-Gasteiz.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-4 text-xs uppercase tracking-[0.2em] font-mono">
              Explorar
            </h3>
            <ul className="space-y-2.5 text-sm">
              {[
                { label: "Inicio", href: "/" },
                { label: "Conciertos", href: "/conciertos" },
                { label: "La Blanca", href: "/fiestas-blanca" },
                { label: "Cultura", href: "/culture" },
                { label: "Deporte", href: "/deporte" },
                { label: "Cartelera", href: "/movies" },
                { label: "Niños", href: "/kids" },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-white/60 hover:text-white transition-colors duration-300">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-4 text-xs uppercase tracking-[0.2em] font-mono">
              Categorías
            </h3>
            <ul className="space-y-2.5 text-sm">
              {[
                { label: "Conciertos", href: "/conciertos", icon: SparklesIcon },
                { label: "Cultura", href: "/culture", icon: FilmIcon },
                { label: "Deporte", href: "/deporte", icon: ActivityIcon },
                { label: "La Blanca", href: "/fiestas-blanca", icon: SparklesIcon },
                { label: "Niños", href: "/kids", icon: SparklesIcon },
                { label: "Cine", href: "/movies", icon: FilmIcon },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-white/60 hover:text-white transition-colors duration-300 flex items-center gap-2">
                    <link.icon className="w-3 h-3" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-4 text-xs uppercase tracking-[0.2em] font-mono">
              Lleva la agenda contigo
            </h3>
            <p className="text-sm text-white/60 mb-4 leading-relaxed">
              Instala la web como app o descárgala desde Google Play.
            </p>
            <div className="flex flex-col gap-2.5">
              <a
                href="https://play.google.com/store/apps/details?id=com.javipaurdev.gasteizclick"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 bg-white/10 hover:bg-white/20 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] px-4 py-3 rounded-xl text-sm text-white"
              >
                <PlayStoreIcon className="w-5 h-5 shrink-0" />
                <span className="flex flex-col leading-tight">
                  <span className="text-[10px] text-white/50 uppercase tracking-[0.1em]">Disponible en</span>
                  <span className="font-semibold">Google Play</span>
                </span>
              </a>
              <div className="inline-flex items-center gap-3 bg-white/5 px-4 py-3 rounded-xl text-sm text-white/50">
                <DownloadIcon className="w-5 h-5 shrink-0" />
                <span className="flex flex-col leading-tight">
                  <span className="text-[10px] text-white/40 uppercase tracking-[0.1em]">Desde el navegador</span>
                  <span className="font-semibold text-white/70">Instalar como app</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 text-center text-white/40 text-sm py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] font-mono text-xs">
          &copy; {new Date().getFullYear()} Gasteiz Click
        </div>
      </div>
    </footer>
  );
}
