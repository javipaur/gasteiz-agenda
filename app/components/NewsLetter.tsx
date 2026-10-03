"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import { useNewsletterSubscribe } from "@/lib/useNewsletterSubscribe";

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 8h12M9 3l5 5-5 5" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.5l3.5 3.5L13 5" />
    </svg>
  );
}

const ERROR_ID = "newsletter-error";

export default function Newsletter() {
  const { email, setEmail, website, setWebsite, status, message, submit } =
    useNewsletterSubscribe();
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section className="px-5 sm:px-6 py-16 md:py-20 max-w-7xl mx-auto">
      <div
        ref={ref}
        className="relative overflow-hidden rounded-[1.5rem] p-8 md:p-12"
        style={{
          background:
            "linear-gradient(135deg, var(--accent-subtle) 0%, var(--accent) 45%, var(--hot) 100%)",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(16px)",
          transition: "all 0.6s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(640px 320px at 12% -20%, rgba(255,255,255,0.16), transparent 60%)" }}
        />

        <div className="relative flex flex-col md:flex-row justify-between gap-8 items-start md:items-center">
          <div className="max-w-md">
            <h3 className="font-display text-2xl md:text-3xl text-white font-semibold tracking-[-0.02em] mb-2">
              No te pierdas <span className="italic text-white/90">nada</span>
            </h3>
            <p className="text-white/80 text-sm md:text-base leading-relaxed">
              Un email a la semana con los mejores planes de Vitoria-Gasteiz.{" "}
              <Link
                href="/suscribete"
                className="inline-flex items-center gap-1 underline underline-offset-4 decoration-white/40 hover:decoration-white transition-colors duration-300"
              >
                Ver qué incluye
                <ArrowIcon className="w-3 h-3" />
              </Link>
            </p>
          </div>

          <div className="w-full md:w-auto relative z-10">
            {status === "success" ? (
              <div className="flex items-center gap-4 rounded-2xl bg-white/10 border border-white/20 px-5 py-4">
                <span className="shrink-0 w-10 h-10 rounded-full bg-white text-accent flex items-center justify-center">
                  <CheckIcon className="w-5 h-5" />
                </span>
                <div>
                  <p className="text-white font-medium text-sm">Suscripción registrada</p>
                  <p className="text-white/75 text-sm">{message}</p>
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Tu email"
                    /*
                      `aria-label` y no solo `placeholder`: el placeholder desaparece
                      en cuanto se escribe y no es un nombre accesible confiable. Hay
                      inputs del repo que ya lo llevan así (`HeroSearch`, `Header`,
                      `BusPageClient`) y este se había quedado sin ninguno.
                    */
                    aria-label="Tu correo electrónico"
                    aria-invalid={status === "error"}
                    aria-describedby={status === "error" ? ERROR_ID : undefined}
                    required
                    autoComplete="email"
                    className="flex-1 sm:w-56 px-4 py-2.5 rounded-lg bg-white/15 border border-white/25 text-white placeholder:text-white/60 focus:outline-none focus:border-white focus:ring-1 focus:ring-white/50 transition-all duration-300 font-body text-sm"
                  />
                  <input
                    type="text"
                    name="website"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    className="absolute -left-[9999px] h-0 w-0 opacity-0 pointer-events-none"
                    style={{ position: "absolute", left: "-9999px" }}
                  />
                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="group inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-accent rounded-lg font-body text-sm font-semibold hover:bg-white/90 transition-all duration-300 active:scale-[0.98] disabled:opacity-60 cursor-pointer shrink-0"
                  >
                    <span>{status === "loading" ? "Enviando…" : "Suscribir"}</span>
                    <ArrowIcon className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                  </button>
                </div>
                {message && status === "error" && (
                  // `role="alert"` para que el lector lo anuncie al aparecer — un
                  // `<p>` más es texto que se pasa por alto — y `id` para que el
                  // campo pueda apuntar a él con `aria-describedby`.
                  <p
                    id={ERROR_ID}
                    role="alert"
                    className="flex items-center gap-1.5 text-xs text-white/90"
                  >
                    {message}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}