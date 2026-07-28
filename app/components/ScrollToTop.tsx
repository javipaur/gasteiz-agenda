"use client";

import { useState, useEffect } from "react";

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Volver arriba"
      className="fixed bottom-6 right-6 z-50 w-11 h-11 rounded-full bg-surface border border-border shadow-lg flex items-center justify-center text-fg-muted hover:text-accent hover:border-accent/30 transition-all duration-300 active:scale-[0.92]"
      style={{
        boxShadow: "0 4px 16px rgba(26, 24, 22, 0.08), 0 1px 4px rgba(26, 24, 22, 0.04)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 12V4M4 7l4-4 4 4" />
      </svg>
    </button>
  );
}
