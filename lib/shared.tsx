"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { formatDate, sourceLabel } from "@/lib/utils";

export { formatDate, sourceLabel };

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 7a3 3 0 100-6 3 3 0 000 6zM5 13a3 3 0 100-6 3 3 0 000 6zM15 19a3 3 0 100-6 3 3 0 000 6zM7.59 11.51l4.83 2.98M12.41 11.51L7.59 8.53" />
    </svg>
  );
}

export type EventCardEvento = {
  id: string;
  title: string;
  date: string;
  image?: string;
  location?: string;
  link?: string;
  category?: string;
  source?: string;
  time?: string;
};

export function InViewWrapper({
  children,
  className,
  delay = 0,
  blur = false,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  blur?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.05 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible
          ? "translateY(0) blur(0)"
          : `translateY(32px)${blur ? " blur(4px)" : ""}`,
        transition: `all 0.8s cubic-bezier(0.32, 0.72, 0, 1) ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

export function EventCard({
  evento,
  showCategory = false,
  showSource = false,
  categoryColors = {},
  size = "normal",
}: {
  evento: EventCardEvento;
  showCategory?: boolean;
  showSource?: boolean;
  categoryColors?: Record<string, string>;
  size?: "normal" | "large" | "compact";
}) {
  const { day, month } = formatDate(evento.date);
  const catColor = categoryColors[evento.category || "Otros"] || "#9C9996";

  const aspectClass = size === "large" ? "aspect-[16/10]" : size === "compact" ? "aspect-[3/2]" : "aspect-[4/3]";

  const handleShare = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const shareData = {
      title: evento.title,
      text: `${evento.title}${evento.location ? ` en ${evento.location}` : ""}`,
      url: evento.link || window.location.href,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch {}
    } else {
      const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareData.text)}&url=${encodeURIComponent(shareData.url)}`;
      window.open(twitterUrl, "_blank", "noopener,noreferrer,width=600,height=400");
    }
  }, [evento]);

  return (
    <a
      href={evento.link || "#"}
      target={evento.link ? "_blank" : undefined}
      rel={evento.link ? "noopener noreferrer" : undefined}
      className="group double-bezel-outer rounded-[1.25rem] p-1.5 block focus-visible:outline-2 focus-visible:outline-accent transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:shadow-lg hover:shadow-accent/5"
    >
      <div className="double-bezel rounded-[calc(1.25rem-0.375rem)] overflow-hidden">
        <div className={`${aspectClass} relative`}>
          {evento.image ? (
            <Image
              src={evento.image}
              alt={evento.title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover transition-transform duration-[800ms] ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 w-full h-full bg-accent-subtle flex items-center justify-center">
              <span className="font-display text-5xl text-accent/20">
                {evento.title.charAt(0)}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

          <div
            className="absolute top-3 left-3 bg-white/15 backdrop-blur-xl rounded-xl px-2.5 py-1.5 text-center leading-tight"
            style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)" }}
          >
            <span className="block font-mono text-[11px] uppercase text-white/70">
              {month}
            </span>
            <span className="block font-display text-lg text-white">
              {day}
            </span>
          </div>

          <button
            onClick={handleShare}
            aria-label="Compartir evento"
            className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-black/30 backdrop-blur-xl text-white/70 hover:text-white hover:bg-black/50 flex items-center justify-center transition-all duration-300 active:scale-[0.92]"
            style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15)" }}
          >
            <ShareIcon className="w-4 h-4" />
          </button>

          <div className="absolute bottom-0 left-0 right-0 p-4">
            {(showCategory || showSource) && (
              <div className="flex items-center gap-1.5 mb-1.5">
                {showCategory && evento.category && (
                  <span
                    className="font-mono text-[11px] uppercase tracking-wider px-1.5 py-0.5"
                    style={{
                      backgroundColor: `${catColor}CC`,
                      color: "white",
                      borderRadius: "3px",
                    }}
                  >
                    {evento.category}
                  </span>
                )}
                {showSource && evento.source && (
                  <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-white/50">
                    {sourceLabel(evento.source)}
                  </span>
                )}
              </div>
            )}
            <h3 className="font-display text-base font-semibold text-white leading-snug mb-1.5 line-clamp-2">
              {evento.title}
            </h3>
            {evento.location && (
              <p className="font-mono text-xs text-white/70 flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-accent inline-block shrink-0" />
                {evento.location}
              </p>
            )}
          </div>
        </div>
      </div>
    </a>
  );
}
