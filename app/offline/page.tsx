import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sin conexión | Gasteiz Click",
  robots: { index: false, follow: false },
};

export default function Offline() {
  return (
    <div className="px-5 sm:px-6 flex flex-col items-center justify-center min-h-[80dvh] text-center">
      <span className="font-display text-[8rem] md:text-[12rem] leading-none font-black text-accent/10 select-none">
        ∅
      </span>
      <h1 className="font-display text-3xl md:text-4xl font-semibold text-fg -mt-6 mb-4 tracking-[-0.02em]">
        Sin conexión
      </h1>
      <p className="text-fg-muted text-base max-w-md mb-8 leading-relaxed">
        No hay internet ahora mismo. Las páginas que ya visitaste siguen disponibles; cuando vuelvas la conexión, podrás ver la agenda al completo.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-full font-body text-sm font-medium hover:bg-accent-hover transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
      >
        Reintentar
        <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M2 7a5 5 0 1 1 1.5 3.6M2 7V3.8M2 7h3.2" />
        </svg>
      </Link>
    </div>
  );
}
