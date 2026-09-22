import Link from "next/link";

export default function NotFound() {
  return (
    <div className="px-5 sm:px-6 flex flex-col items-center justify-center min-h-[80dvh] text-center">
      <span className="font-display text-[8rem] md:text-[12rem] leading-none font-black text-accent/10 select-none">
        404
      </span>
      <h1 className="font-display text-3xl md:text-4xl font-semibold text-fg -mt-6 mb-4 tracking-[-0.02em]">
        Página no encontrada
      </h1>
      <p className="text-fg-muted text-base max-w-md mb-8 leading-relaxed">
        La página que buscas no existe o ha sido movida. Explora los eventos de Vitoria-Gasteiz desde el inicio.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-full font-body text-sm font-medium hover:bg-accent-hover transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
      >
        Volver al inicio
        <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M11 7H3M7 3l-4 4 4 4" />
        </svg>
      </Link>
    </div>
  );
}
