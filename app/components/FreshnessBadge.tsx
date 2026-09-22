"use client";

import { useEffect, useState } from "react";

export default function FreshnessBadge({ since }: { since: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, []);

  const secs = Math.max(0, Math.round((now - since) / 1000));
  const label =
    secs < 90
      ? `hace ${secs} s`
      : secs < 3600
        ? `hace ${Math.round(secs / 60)} min`
        : `hace ${Math.round(secs / 3600)} h`;

  return (
    <span className="inline-flex items-center gap-1.5 select-none">
      <span aria-hidden="true" className="relative flex size-2">
        <span className="live-dot-pulse absolute inline-flex h-full w-full rounded-full bg-green" />
        <span className="relative inline-flex size-2 rounded-full bg-green" />
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-fg-subtle tabular-nums">
        Actualizado {label}
      </span>
    </span>
  );
}