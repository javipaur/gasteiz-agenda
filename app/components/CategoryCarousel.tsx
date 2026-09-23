"use client";

import { useRef } from "react";
import Link from "next/link";
import { InViewWrapper, EventCard, type EventCardEvento } from "@/lib/shared";
import SectionHead from "./SectionHead";

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3l5 5-5 5" />
    </svg>
  );
}

export default function CategoryCarousel({
  title,
  subtitle,
  events,
  href,
  categoryColors,
  variant = "rail",
  tag,
  tagColor,
}: {
  title: string;
  subtitle?: string;
  events: EventCardEvento[];
  href?: string;
  categoryColors?: Record<string, string>;
  variant?: "rail" | "grid";
  tag?: string;
  tagColor?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  function scrollBy(dir: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: "smooth" });
  }

  if (events.length === 0) return null;

  return (
    <section
      className={
        variant === "grid"
          ? "px-5 sm:px-6 py-10 md:py-14"
          : "px-5 sm:px-6 py-10 md:py-14 bg-bg-muted"
      }
    >
      <div className="max-w-7xl mx-auto">
        <InViewWrapper>
          <div className="flex items-end justify-between gap-4 mb-6">
            <SectionHead
              tag={tag}
              title={title}
              subtitle={subtitle}
              href={href}
              color={tagColor}
            />
            {variant === "rail" && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => scrollBy(-1)}
                  aria-label="Anterior"
                  className="grid size-9 place-items-center rounded-full border border-border bg-surface text-fg-muted hover:text-accent hover:border-accent/40 transition-all duration-300 active:scale-[0.92] cursor-pointer disabled:opacity-40"
                >
                  <ArrowIcon className="w-4 h-4 rotate-180" />
                </button>
                <button
                  onClick={() => scrollBy(1)}
                  aria-label="Siguiente"
                  className="grid size-9 place-items-center rounded-full border border-border bg-surface text-fg-muted hover:text-accent hover:border-accent/40 transition-all duration-300 active:scale-[0.92] cursor-pointer"
                >
                  <ArrowIcon className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </InViewWrapper>

        {variant === "grid" ? (
          <InViewWrapper>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {events.map((evento, i) => (
                <EventCard
                  key={evento.id}
                  evento={evento}
                  showSource
                  categoryColors={categoryColors}
                  size="compact"
                  priority={i < 4}
                />
              ))}
            </div>
            {href && (
              <div className="mt-8 sm:hidden">
                <Link
                  href={href}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover transition-colors duration-300"
                >
                  Ver todo
                  <ArrowIcon className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </InViewWrapper>
        ) : (
          <InViewWrapper>
            <div
              ref={scrollerRef}
              className="flex gap-4 overflow-x-auto scrollbar-none snap-x snap-mandatory pb-2 -mx-1 px-1"
            >
              {events.map((evento, i) => (
                <div
                  key={evento.id}
                  className="w-[64vw] sm:w-72 shrink-0 snap-start"
                >
                  <EventCard
                    evento={evento}
                    showSource
                    categoryColors={categoryColors}
                    size="compact"
                    priority={i < 3}
                  />
                </div>
              ))}
            </div>
          </InViewWrapper>
        )}
      </div>
    </section>
  );
}