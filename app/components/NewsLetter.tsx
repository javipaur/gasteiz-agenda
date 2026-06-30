"use client";

import { useState, FormEvent } from "react";

export default function Newsletter() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

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
    <section className="px-6 py-16 md:py-24 max-w-7xl mx-auto">
      <div className="bg-green rounded-[2rem] p-8 md:p-12 flex flex-col md:flex-row justify-between gap-6 items-center">
        <div>
          <h2 className="font-display text-3xl text-white mb-2">
            No te pierdas nada
          </h2>
          <p className="text-white/80">
            Recibe los eventos de Vitoria cada semana
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-2 w-full md:w-auto">
          <div className="flex gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Tu email"
              required
              className="flex-1 md:w-56 px-4 py-3 rounded-xl bg-white/10 text-white border border-white/20 placeholder:text-white/40 focus:outline-none focus:border-white/60 transition-colors font-body text-sm"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="px-6 py-3 bg-red text-white rounded-xl font-semibold font-body text-sm hover:bg-red-dark transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
            >
              {status === "loading" ? "..." : "Suscribirse"}
            </button>
          </div>
          {message && (
            <p
              className={`text-xs font-mono ${
                status === "success" ? "text-white/70" : "text-red/80"
              }`}
            >
              {message}
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
