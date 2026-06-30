import Link from "next/link";
import { Film, Activity, Sparkles } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-ink text-stone mt-20">
      <div className="max-w-7xl mx-auto px-6 py-12 grid md:grid-cols-4 gap-8">
        <div>
          <h2 className="font-display text-2xl font-bold text-white mb-4">
            Gasteiz Click
          </h2>
          <p className="text-sm text-stone-dark">
            Descubre eventos, deporte y cultura en Vitoria-Gasteiz.
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider font-mono">
            Explorar
          </h3>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/" className="hover:text-white transition-colors">
                Inicio
              </Link>
            </li>
            <li>
              <Link
                href="/culture"
                className="hover:text-white transition-colors"
              >
                Cultura
              </Link>
            </li>
            <li>
              <Link
                href="/deporte"
                className="hover:text-white transition-colors"
              >
                Deporte
              </Link>
            </li>
            <li>
              <Link
                href="/movies"
                className="hover:text-white transition-colors"
              >
                Cartelera
              </Link>
            </li>
            <li>
              <Link
                href="/kids"
                className="hover:text-white transition-colors"
              >
                Con niños
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider font-mono">
            Categorías
          </h3>
          <ul className="space-y-2 text-sm">
            <li>
              <Link
                href="/culture"
                className="hover:text-white transition-colors flex items-center gap-2"
              >
                <Film className="w-3 h-3" />
                Cultura
              </Link>
            </li>
            <li>
              <Link
                href="/deporte"
                className="hover:text-white transition-colors flex items-center gap-2"
              >
                <Activity className="w-3 h-3" />
                Deporte
              </Link>
            </li>
            <li>
              <Link
                href="/kids"
                className="hover:text-white transition-colors flex items-center gap-2"
              >
                <Sparkles className="w-3 h-3" />
                Kids
              </Link>
            </li>
            <li>
              <Link
                href="/movies"
                className="hover:text-white transition-colors flex items-center gap-2"
              >
                <Film className="w-3 h-3" />
                Cine
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider font-mono">
            App Android
          </h3>
          <p className="text-sm text-stone-dark mb-3">
            Lleva la agenda en tu bolsillo
          </p>
          <a
            href="https://play.google.com/store/apps/details?id=com.javipaurdev.gasteizclick"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 transition-colors rounded-xl px-4 py-3 text-sm text-white"
          >
            <svg viewBox="0 0 512 512" className="w-5 h-5 shrink-0" fill="currentColor">
              <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z"/>
            </svg>
            <span className="flex flex-col leading-tight">
              <span className="text-[10px] text-stone-dark uppercase tracking-wider">Disponible en</span>
              <span className="font-semibold">Google Play</span>
            </span>
          </a>
        </div>
      </div>

      <div className="border-t border-ink-light/20 text-center text-stone-dark text-sm py-6 font-mono">
        &copy; {new Date().getFullYear()} Gasteiz Click
      </div>
    </footer>
  );
}
