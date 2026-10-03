"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const CONSENT_KEY = "gasteiz-cookie-consent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        setVisible(localStorage.getItem(CONSENT_KEY) !== "accepted");
      } catch {
        setVisible(true);
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(CONSENT_KEY, "accepted");
    } catch {
      // localStorage no disponible: ignorar
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Aviso de privacidad y cookies"
      className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-xl"
    >
      <div className="rounded-2xl border border-border bg-surface shadow-xl p-5">
        <p className="text-sm text-fg-muted leading-relaxed mb-4">
          <strong className="text-fg">Gasteiz Click</strong> no usa cookies de
          seguimiento: solo guarda tu tema y favoritos en el almacenamiento local
          de tu navegador y mide visitas con analítica agregada. Consulta nuestra{" "}
          <Link
            href="/privacidad"
            onClick={accept}
            className="text-accent underline underline-offset-4 decoration-border hover:text-accent-hover"
          >
            política de privacidad
          </Link>
          .
        </p>
        <button
          onClick={accept}
          // `py-2.5 text-sm` medía 40 px de alto. Es el único botón del aviso, y un
          // aviso que aparece sin pedirlo se cierra sobre todo con pulgar.
          className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-all duration-300 active:scale-[0.98] cursor-pointer"
        >
          Aceptar
        </button>
      </div>
    </div>
  );
}