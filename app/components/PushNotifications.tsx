"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

type Status =
  | { kind: "loading" }
  | { kind: "unsupported" }
  | { kind: "off" }
  | { kind: "blocked" }
  | { kind: "on" }
  | { kind: "error"; message: string };

export default function PushNotifications() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      ) {
        if (!cancelled) setStatus({ kind: "unsupported" });
        return;
      }

      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) {
          setStatus(
            Notification.permission === "denied"
              ? { kind: "blocked" }
              : sub
                ? { kind: "on" }
                : { kind: "off" }
          );
        }
      } catch {
        if (!cancelled) setStatus({ kind: "unsupported" });
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setStatus({ kind: "blocked" });
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string
          ),
        }));

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });

      if (!res.ok) throw new Error(`API ${res.status}`);
      setStatus({ kind: "on" });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Error desconocido",
      });
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus({ kind: "off" });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Error desconocido",
      });
    } finally {
      setBusy(false);
    }
  }

  if (status.kind === "loading" || status.kind === "unsupported") return null;

  return (
    <section className="mt-10 px-5 sm:px-6">
      <div className="max-w-2xl mx-auto border border-line rounded-2xl p-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-fg tracking-[-0.01em]">
            Avisos de eventos
          </h2>
          <p className="text-fg-muted text-sm mt-1 leading-relaxed">
            {status.kind === "on"
              ? "Recibirás una notificación cuando haya novedades."
              : status.kind === "blocked"
                ? "Las notificaciones están bloqueadas en los ajustes del navegador."
                : status.kind === "error"
                  ? `No se pudo activar: ${status.message}`
                  : "Te avisamos con lo mejor de la agenda de Vitoria-Gasteiz."}
          </p>
        </div>

        {status.kind === "on" ? (
          <button
            onClick={disable}
            disabled={busy}
            className="shrink-0 px-5 py-2.5 rounded-full font-body text-sm font-medium border border-line text-fg hover:bg-bg-elevated transition-colors duration-300 disabled:opacity-50"
          >
            {busy ? "…" : "Desactivar"}
          </button>
        ) : status.kind !== "blocked" ? (
          <button
            onClick={enable}
            disabled={busy}
            className="shrink-0 px-5 py-2.5 rounded-full font-body text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? "…" : "Activar"}
          </button>
        ) : null}
      </div>
    </section>
  );
}
