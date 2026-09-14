import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

function PlayStoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 512 512" fill="currentColor">
      <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z" />
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

export default function Footer() {
  const now = new Date();
  const agendaUrl = `/agenda/${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const exploreLinks = [
    { label: "Inicio", href: "/" },
    { label: "Conciertos", href: "/conciertos" },
    { label: "La Blanca", href: "/fiestas-blanca" },
    { label: "Cultura", href: "/culture" },
    { label: "Deporte", href: "/deporte" },
    { label: "Cartelera", href: "/movies" },
    { label: "Niños", href: "/kids" },
  ];

  return (
    <footer className="mt-20">
      <div className="bg-[#1A1816] text-white">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 py-16 md:py-20 grid md:grid-cols-[1.4fr_1fr] gap-12 md:gap-10">
          <div>
            <h2 className="font-display text-2xl font-bold text-white mb-3 tracking-[-0.02em]">
              Gasteiz Click
            </h2>
            <p className="text-sm text-white/60 leading-relaxed max-w-sm mb-8">
              La agenda cultural de Vitoria-Gasteiz: conciertos, teatro, cine,
              deporte y planes familiares, actualizados a diario.
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5 max-w-md">
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
              <a
                href="/manifest.json"
                className="inline-flex items-center gap-3 bg-white/5 hover:bg-white/10 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] px-4 py-3 rounded-xl text-sm text-white/70"
              >
                <DownloadIcon className="w-5 h-5 shrink-0" />
                <span className="flex flex-col leading-tight">
                  <span className="text-[10px] text-white/40 uppercase tracking-[0.1em]">Desde el navegador</span>
                  <span className="font-semibold text-white/70">Instalar como app</span>
                </span>
              </a>
            </div>
          </div>

          <nav aria-label="Enlaces del sitio">
            <h3 className="font-semibold text-white mb-4 text-xs uppercase tracking-[0.2em] font-mono">
              Explorar
            </h3>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
              {exploreLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-white/60 hover:text-white transition-colors duration-300">
                    {link.label}
                  </Link>
                </li>
              ))}
              <li className="col-span-2">
                <Link href={agendaUrl} className="text-white/60 hover:text-white transition-colors duration-300">
                  Agenda mensual
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-5 sm:px-6 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs text-white/40">
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-5">
              <p>
                &copy; {now.getFullYear()} Gasteiz Click · Hecho en Vitoria-Gasteiz
              </p>
              <ThemeToggle />
            </div>
            <div className="flex items-center gap-5">
              <Link href="/sobre" className="hover:text-white/70 transition-colors duration-300">
                Sobre
              </Link>
              <Link href="/privacidad" className="hover:text-white/70 transition-colors duration-300">
                Privacidad
              </Link>
              <a href="/feed.xml" className="hover:text-white/70 transition-colors duration-300">
                RSS
              </a>
              <a href="mailto:hola@javierpalacio.es" className="hover:text-white/70 transition-colors duration-300">
                Contacto
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
