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
    <section className="px-5 sm:px-6 py-16 md:py-20 max-w-7xl mx-auto">
      <div
        ref={ref}
        className="rounded-2xl border border-border bg-surface p-8 md:p-10"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(16px)',
          transition: 'all 0.6s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        <div className="flex flex-col md:flex-row justify-between gap-6 items-start md:items-center">
          <div>
            <h2 className="font-display text-xl md:text-2xl text-fg mb-1 tracking-[-0.02em]">
              No te pierdas nada
            </h2>
            <p className="text-fg-muted text-sm">
              Un email a la semana con los mejores planes de Vitoria
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full md:w-auto">
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Tu email"
                required
                className="flex-1 md:w-52 px-4 py-2.5 rounded-lg bg-bg-muted border border-border text-fg placeholder:text-fg-subtle focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all duration-300 font-body text-sm"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="group inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-white rounded-lg font-body text-sm font-medium hover:bg-accent-hover transition-all duration-300 active:scale-[0.98] disabled:opacity-50 cursor-pointer shrink-0"
              >
                <span>{status === "loading" ? "..." : "Suscribir"}</span>
                <ArrowIcon className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
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
