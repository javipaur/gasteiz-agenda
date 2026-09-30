"use client";

import { useState, FormEvent, useEffect, useRef } from "react";

type Status = "idle" | "loading" | "success" | "error";

export function useNewsletterSubscribe() {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          website,
          startedAt: startedAtRef.current,
        }),
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

  return { email, setEmail, website, setWebsite, status, message, submit };
}