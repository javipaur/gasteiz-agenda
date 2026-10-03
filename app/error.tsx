"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useLogger } from "@/lib/axiom/client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const log = useLogger();

  useEffect(() => {
    log.error("App error", {
      source: "app/error.tsx",
      message: error.message,
      name: error.name,
      stack: error.stack,
      digest: error.digest,
      url: window.location.href,
    });
  }, [error, log]);

  return (
    <div className="px-5 sm:px-6 flex flex-col items-center justify-center min-h-[80dvh] text-center">
      <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-6">
        <svg className="w-8 h-8 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      </div>
      <h1 className="font-display text-3xl md:text-4xl font-semibold text-fg mb-4 tracking-[-0.02em]">
        Algo ha salido mal
      </h1>
      <p className="text-fg-muted text-base max-w-md mb-8 leading-relaxed">
        {/*
          Este es el error boundary **raíz**: también cubre `/privacidad`,
          `/aviso-legal`, `/docs` y `/bus`, donde no hay eventos que cargar. Decir
          "ha habido un problema al cargar los eventos" afirma algo falso sobre la
          página que se está viendo.
        */}
        Ha habido un problema al cargar esta página. Inténtalo de nuevo o vuelve al inicio.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-full font-body text-sm font-medium hover:bg-accent-hover transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
        >
          Reintentar
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-bg-muted text-fg rounded-full font-body text-sm font-medium hover:bg-border transition-all duration-300"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
