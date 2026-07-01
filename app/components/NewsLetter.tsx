"use client";

import { useState, FormEvent, useRef, useEffect } from "react";

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 8h12M9 3l5 5-5 5" />
    </svg>
  );
}

export default function Newsletter() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (res.ok) {
        setStatus("success");
        setMessage(data.message);
        setEmail("");
      } else {
        setStatus("error");
        setMessage(data.error || "Error al suscribir");
      }
    } catch {
      setStatus("error");
      setMessage("Error de conexión");
    }
  }

  return (
    <section className="px-4 py-20 md:py-28 max-w-7xl mx-auto">
      <div
        ref={ref}
        className="double-bezel-outer rounded-[1.75rem] p-2"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(24px)',
          transition: 'all 0.8s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        <div className="double-bezel rounded-[calc(1.75rem-0.375rem)] p-8 md:p-12 flex flex-col md:flex-row justify-between gap-8 items-center">
          <div className="text-center md:text-left">
            <h2 className="font-display text-3xl md:text-4xl text-fg mb-2 tracking-[-0.02em]">
              No te pierdas nada
            </h2>
            <p className="text-fg-muted text-sm md:text-base">
              Recibe los eventos de Vitoria cada semana
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full md:w-auto">
            <div className="flex gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Tu email"
                required
                className="flex-1 md:w-56 px-4 py-3 rounded-xl bg-bg-muted border border-border text-fg placeholder:text-fg-subtle focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all duration-300 font-body text-sm"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="group inline-flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-full font-body text-sm font-medium hover:bg-accent-hover transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                <span>{status === "loading" ? "..." : "Suscribirse"}</span>
                <span className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-[1px] group-hover:scale-105">
                  <ArrowIcon className="w-3.5 h-3.5" />
                </span>
              </button>
            </div>
            {message && (
              <p className={`text-xs font-mono ${status === "success" ? "text-green" : "text-accent"}`}>
                {message}
              </p>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}
