"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { formatDate } from "@/lib/utils";
import { InViewWrapper } from "@/lib/shared";

type SearchHit = {
  slug: string;
  title: string;
  date: string;
  image?: string;
  location?: string;
};

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="8" r="5.5" />
      <path d="M12.5 12.5L17 17" />
    </svg>
  );
}

export default function HeroSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      setOpen(false);
      return;
    }
    const ctrl = new AbortController();
    setSearching(true);
    setOpen(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = await res.json();
        setResults(Array.isArray(data.results) ? data.results : []);
      } catch {
        /* aborted or network error */
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (formRef.current && !formRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const goToHit = useCallback(
    (slug: string) => {
      router.push(`/evento/${slug}`);
      setOpen(false);
      setQuery("");
      setResults([]);
    },
    [router]
  );

  return (
    <InViewWrapper eager className="relative">
      <form
        ref={formRef}
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const q = query.trim();
          if (!q) return;
          router.push(`/culture?q=${encodeURIComponent(q)}`);
          setOpen(false);
          setQuery("");
          setResults([]);
        }}
        className="relative w-full"
      >
        <SearchIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle pointer-events-none" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          placeholder="¿Qué te gustaría hacer? Busca un plan…"
          aria-label="Buscar eventos"
          className="w-full pl-13 pr-16 py-4 rounded-full bg-bg-elevated border border-border text-fg placeholder:text-fg-subtle focus:outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/15 transition-all duration-300 font-body text-base"
        />
        <kbd className="absolute right-5 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-0.5 font-mono text-[10px] text-fg-subtle border border-border rounded-md px-1.5 py-0.5 bg-bg-muted">
          ⌘K
        </kbd>

        {open && (
          <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-border bg-bg-elevated shadow-xl overflow-hidden z-[var(--z-dropdown)] animate-scaleIn">
            {searching && results.length === 0 ? (
              <p className="px-4 py-3.5 font-mono text-xs text-fg-subtle">Buscando…</p>
            ) : results.length > 0 ? (
              <>
                <ul>
                  {results.slice(0, 7).map((hit) => {
                    const { day, month } = formatDate(hit.date);
                    return (
                      <li key={hit.slug}>
                        <button
                          type="button"
                          onClick={() => goToHit(hit.slug)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-bg-muted transition-colors duration-200 cursor-pointer"
                        >
                          <span className="relative w-9 h-9 rounded-lg overflow-hidden bg-bg-muted shrink-0 flex items-center justify-center">
                            {hit.image ? (
                              <Image src={hit.image} alt="" fill sizes="36px" className="object-cover" />
                            ) : (
                              <span className="font-display text-sm text-fg-subtle">{hit.title.charAt(0)}</span>
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium text-fg truncate">{hit.title}</span>
                            <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-fg-subtle truncate">
                              {day} {month}
                              {hit.location ? ` · ${hit.location}` : ""}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <Link
                  href={`/culture?q=${encodeURIComponent(query.trim())}`}
                  onClick={() => {
                    setOpen(false);
                    setQuery("");
                    setResults([]);
                  }}
                  className="block border-t border-border px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-accent hover:bg-bg-muted transition-colors duration-200"
                >
                  Ver todos los resultados
                </Link>
              </>
            ) : query.trim().length >= 2 ? (
              <p className="px-4 py-3.5 font-mono text-xs text-fg-subtle">
                Sin resultados para “{query.trim()}”
              </p>
            ) : null}
          </div>
        )}
      </form>
    </InViewWrapper>
  );
}