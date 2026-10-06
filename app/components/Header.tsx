"use client";

import Link from "next/link";
import Image from "next/image";
import { imagenServible } from "@/lib/image-hosts";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useRef, useSyncExternalStore } from "react";
import { Heart } from "lucide-react";
import { useFavorites } from "@/app/context/FavoritesContext";
import { formatDate } from "@/lib/utils";
import { isBlancaSeason } from "@/lib/blanca";
import { useInstallPrompt, promptInstall } from "@/lib/useInstallPrompt";
import ShortcutHint from "./ShortcutHint";
import { LogoMark } from "./LogoMark";

type SearchHit = {
  slug: string;
  title: string;
  date: string;
  image?: string;
  location?: string;
};

const navItems = [
  { name: "Inicio", href: "/" },
  { name: "La Blanca", href: "/fiestas-blanca", accent: true },
  { name: "Conciertos", href: "/conciertos" },
  { name: "Cartelera", href: "/movies" },
  { name: "Niños", href: "/kids" },
  { name: "Cultura", href: "/culture" },
  { name: "Deporte", href: "/deporte" },
  { name: "Turismo", href: "/turismo" },
  { name: "Gastronomía", href: "/gastronomia" },
];

/** Id estable del panel, para que el botón pueda apuntarlo con `aria-controls`. */
const CATEGORIAS_PANEL_ID = "categorias-panel";

/**
 * Los enlaces del desplegable, agrupados. Salen de una constante y no de cuatro
 * listas escritas dentro del JSX porque, al dejar de ser un `role="menu"`, cada
 * grupo tiene que ser una `<ul>` con su `<li>` y su etiqueta: montarlo a mano cuatro
 * veces era la forma más fácil de que una se quedara sin lista.
 */
const GRUPOS_CATEGORIAS: { titulo: string; enlaces: { label: string; href: string }[] }[] = [
  {
    titulo: "Música",
    enlaces: [
      { label: "Conciertos", href: "/conciertos" },
      { label: "Jimmy Jazz", href: "/conciertos" },
      { label: "VAM Cultura", href: "/conciertos" },
    ],
  },
  {
    titulo: "Cultura",
    enlaces: [
      { label: "Teatro", href: "/culture/teatro" },
      { label: "Exposiciones", href: "/culture/exposiciones" },
      { label: "Agenda cultural", href: "/culture/agenda" },
    ],
  },
  {
    titulo: "Ocio",
    enlaces: [
      { label: "Cartelera", href: "/movies" },
      { label: "Planes familiares", href: "/kids" },
      { label: "Fiestas La Blanca", href: "/fiestas-blanca" },
      { label: "Turismo", href: "/turismo" },
      { label: "Gastronomía", href: "/gastronomia" },
      { label: "Bus y tranvía", href: "/bus" },
      { label: "Farmacias", href: "/farmacias" },
    ],
  },
  {
    titulo: "Activo",
    enlaces: [
      { label: "Deporte", href: "/deporte" },
      { label: "Senderismo", href: "/deporte" },
      { label: "Carreras", href: "/deporte" },
    ],
  },
];

function getVisibleNavItems() {
  return isBlancaSeason()
    ? navItems
    : navItems.filter((item) => !item.accent);
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3v10M6 9l4 4 4-4" />
      <path d="M3 14v2a1 1 0 001 1h12a1 1 0 001-1v-2" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="8" r="5.5" />
      <path d="M12.5 12.5L17 17" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M5 5l10 10M15 5l-10 10" />
    </svg>
  );
}

function PlayStoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 512 512" fill="currentColor">
      <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z" />
    </svg>
  );
}

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const installAvailable = useInstallPrompt();
  const isStandalone = useSyncExternalStore(
    useCallback((onChange: () => void) => {
      const mq = window.matchMedia("(display-mode: standalone)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }, []),
    useCallback(
      () =>
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as Navigator & { standalone?: boolean })
          .standalone === true,
      []
    ),
    () => false
  );
  const { count } = useFavorites();
  const visibleNavItems = getVisibleNavItems();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchFormRef = useRef<HTMLFormElement>(null);
  const categoriesRef = useRef<HTMLDivElement>(null);
  const categoriasBotonRef = useRef<HTMLButtonElement>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isMenuOpen]);

  const menuOverlayRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;
    const overlay = menuOverlayRef.current;
    const opener = menuButtonRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = overlay
      ? Array.from(
          overlay.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'
          )
        )
      : [];

    if (focusables.length > 0) {
      requestAnimationFrame(() => focusables[0].focus());
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMenuOpen(false);
        return;
      }
      if (e.key !== "Tab" || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previouslyFocused && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      } else {
        opener?.focus();
      }
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!searchOpen || q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    const ctrl = new AbortController();
    setSearching(true);
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
  }, [searchQuery, searchOpen]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchFormRef.current && !searchFormRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    if (searchOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [searchOpen]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (categoriesRef.current && !categoriesRef.current.contains(e.target as Node)) {
        setCategoriesOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setCategoriesOpen(false);
      // Escape con el foco dentro del panel desmontaba el panel y el foco caía a
      // `document.body`, así que el siguiente Tab reiniciaba desde el principio
      // del documento. El disclosure se cierra, pero quien lo cierra sigue siendo
      // el botón: el foco vuelve a él, que es donde se puede volver a abrir.
      categoriasBotonRef.current?.focus();
    }
    if (categoriesOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", onKey);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", onKey);
      };
    }
  }, [categoriesOpen]);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    router.push(`/culture?q=${encodeURIComponent(q)}`);
    setSearchQuery("");
    setSearchOpen(false);
    setResults([]);
    setIsMenuOpen(false);
  }, [searchQuery, router]);

  const goToHit = useCallback((slug: string) => {
    router.push(`/evento/${slug}`);
    setSearchQuery("");
    setSearchOpen(false);
    setResults([]);
  }, [router]);

  const handleInstall = useCallback(async () => {
    await promptInstall();
  }, []);

  return (
    <>
      <header
        className={`fixed left-0 right-0 z-[var(--z-nav)] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          scrolled || isStandalone ? "mt-0" : "mt-0 md:mt-4"
        }`}
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <div className={`
          relative mx-auto transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]
          ${scrolled || isStandalone
            ? "max-w-full rounded-none bg-bg/90 backdrop-blur-xl border-b border-border"
            : "max-w-[calc(100%-2rem)] lg:max-w-5xl rounded-full bg-bg/90 backdrop-blur-xl border border-border shadow-sm"
          }
        `}>
          {scrolled && !isStandalone && (
            <span
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent"
            />
          )}
          <div className="flex items-center justify-between px-4 md:px-6 py-2.5 md:py-2">
            <Link
              href="/"
              aria-label="Gasteiz Click — Inicio"
              className="flex items-center gap-2 shrink-0 text-fg transition-colors duration-300"
            >
              <LogoMark className="w-6 h-6 md:w-7 md:h-7 shrink-0" spiral="var(--color-accent)" />
              <span className="font-display text-lg md:text-xl font-semibold tracking-tight leading-none">
                Gasteiz<span className="text-accent">Click</span>
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-0.5 mx-2" aria-label="Navegación principal">
              <div ref={categoriesRef} className="relative">
                <button
                  ref={categoriasBotonRef}
                  onClick={() => setCategoriesOpen((v) => !v)}
                  aria-expanded={categoriesOpen}
                  aria-controls={CATEGORIAS_PANEL_ID}
                  aria-haspopup="true"
                  className={`px-3 py-1.5 text-sm whitespace-nowrap rounded-full transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer inline-flex items-center gap-1.5 ${
                    categoriesOpen
                      ? "bg-accent-soft text-accent font-medium"
                      : "text-fg-muted hover:text-fg hover:bg-bg-muted"
                  }`}
                >
                  Categorías
                  <svg
                    className={`w-3 h-3 transition-transform duration-300 ${categoriesOpen ? "rotate-180" : ""}`}
                    viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M4 6l4 4 4-4" />
                  </svg>
                </button>

                {categoriesOpen && (
                  <div
                    id={CATEGORIAS_PANEL_ID}
                    className="absolute left-0 top-full mt-2 w-[420px] rounded-2xl border border-border bg-bg-elevated shadow-xl overflow-hidden z-[var(--z-dropdown)] animate-scaleIn"
                  >
                    {/*
                      Sin `role="menu"` ni `role="menuitem"`, a propósito. El patrón
                      ARIA de menú exige teclado de menú —flechas, Home/End y
                      `tabIndex`— y aquí no lo hay: con los roles puestos, el lector
                      entra en modo navegación de menú, Tab deja de recorrer los
                      enlaces y las flechas no mueven nada. Es una lista de enlaces
                      de navegación, y declarándola como lista cada enlace sale
                      alcanzable con Tab y se anuncia como enlace.
                    */}
                    <div className="grid grid-cols-2 gap-y-1 p-2">
                      {GRUPOS_CATEGORIAS.map((grupo) => (
                        <div key={grupo.titulo}>
                          <p
                            id={`${CATEGORIAS_PANEL_ID}-${grupo.titulo.toLowerCase()}`}
                            className="px-3 pt-2 pb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-fg-subtle"
                          >
                            {grupo.titulo}
                          </p>
                          <ul aria-labelledby={`${CATEGORIAS_PANEL_ID}-${grupo.titulo.toLowerCase()}`}>
                            {grupo.enlaces.map((l) => (
                              <li key={l.label}>
                                <Link
                                  href={l.href}
                                  onClick={() => setCategoriesOpen(false)}
                                  className="block px-3 py-1.5 text-sm text-fg-muted hover:text-accent hover:bg-bg-muted rounded-lg transition-colors duration-200"
                                >
                                  {l.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {visibleNavItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`px-3 py-1.5 text-sm whitespace-nowrap rounded-full transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                      isActive
                        ? "bg-accent-soft text-accent font-medium"
                        : "text-fg-muted hover:text-fg hover:bg-bg-muted"
                    }`}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-1">
              <form
                ref={searchFormRef}
                onSubmit={handleSearch}
                className="relative flex items-center"
                role="search"
              >
                <div
                  className={`
                    flex items-center transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] overflow-hidden
                    ${searchOpen
                      ? "w-48 md:w-56 opacity-100"
                      : "w-0 opacity-0"
                    }
                  `}
                >
                  <input
                    ref={searchInputRef}
                    type="search"
                    placeholder="Buscar eventos..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setSearchOpen(false);
                        setResults([]);
                      }
                    }}
                    className="w-full pl-9 pr-12 py-1.5 text-sm bg-bg-muted border border-border text-fg placeholder:text-fg-subtle focus:outline-none focus:border-accent transition-all duration-300"
                    style={{ borderRadius: '999px' }}
                    aria-label="Buscar eventos"
                  />
                  <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle pointer-events-none" />
                  {/*
                    `ShortcutHint` y no el texto fijo: el atajo se acepta con
                    `metaKey` **o** `ctrlKey`, así que en Windows y Linux es
                    `Ctrl K`. Escribir `⌘K` a pelo hacía que el cartel describiera
                    una tecla que no existe en esa máquina.
                  */}
                  <ShortcutHint
                    className={`absolute right-2 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border border-border bg-surface font-mono text-[10px] text-fg-subtle pointer-events-none transition-opacity duration-300 ${
                      searchQuery ? "opacity-0" : "opacity-100"
                    }`}
                  />
                </div>
                {searchOpen && (
                  <div className="absolute left-auto right-0 top-full mt-2 w-[calc(100%+4rem)] max-w-sm rounded-2xl border border-border bg-bg-elevated shadow-xl overflow-hidden z-[var(--z-dropdown)] animate-scaleIn">
                    {searching && results.length === 0 ? (
                      <p className="px-4 py-3.5 font-mono text-xs text-fg-subtle">
                        Buscando…
                      </p>
                    ) : results.length > 0 ? (
                      <>
                        <ul>
                          {results.map((hit) => {
                            const { day, month } = formatDate(hit.date);
                            return (
                              <li key={hit.slug}>
                                <button
                                  type="button"
                                  onClick={() => goToHit(hit.slug)}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-bg-muted transition-colors duration-200 cursor-pointer"
                                >
                                  <span className="relative w-9 h-9 rounded-lg overflow-hidden bg-bg-muted shrink-0 flex items-center justify-center">
                                    {imagenServible(hit.image) ? (
                                      <Image src={hit.image} alt="" fill sizes="36px" className="object-cover" />
                                    ) : (
                                      <span className="font-display text-sm text-fg-subtle">{hit.title.charAt(0)}</span>
                                    )}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-medium text-fg truncate">{hit.title}</span>
                                    <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-fg-subtle truncate">
                                      {day} {month}{hit.location ? ` · ${hit.location}` : ""}
                                    </span>
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                        <Link
                          href={`/culture?q=${encodeURIComponent(searchQuery.trim())}`}
                          onClick={() => {
                            setSearchOpen(false);
                            setResults([]);
                            setSearchQuery("");
                          }}
                          className="block border-t border-border px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-accent hover:bg-bg-muted transition-colors duration-200"
                        >
                          Ver todos los resultados
                        </Link>
                      </>
                    ) : searchQuery.trim().length >= 2 ? (
                      <p className="px-4 py-3.5 font-mono text-xs text-fg-subtle">
                        Sin resultados para “{searchQuery.trim()}”
                      </p>
                    ) : null}
                  </div>
                )}
                <button
                  type={searchOpen ? "submit" : "button"}
                  onClick={(e) => {
                    if (!searchOpen) {
                      e.preventDefault();
                      setSearchOpen(true);
                    }
                  }}
                  className={`p-2.5 min-w-[44px] min-h-[44px] rounded-full transition-all duration-300 ${
                    searchOpen ? "hidden" : "flex"
                  } text-fg-muted hover:text-fg hover:bg-bg-muted`}
                  aria-label="Buscar"
                >
                  <SearchIcon className="w-4 h-4" />
                </button>
              </form>

              <Link
                href="/favoritos"
                className={`relative hidden md:flex items-center justify-center p-2.5 min-w-[44px] min-h-[44px] rounded-full transition-all duration-300 ${
                  pathname === "/favoritos"
                    ? "text-accent bg-accent-soft"
                    : "text-fg-muted hover:text-fg hover:bg-bg-muted"
                }`}
                aria-label="Favoritos"
              >
                <Heart size={16} strokeWidth={1.5} />
                {count > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-accent text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </Link>

              {installAvailable && (
                <button
                  onClick={handleInstall}
                  className="hidden md:flex p-2.5 min-w-[44px] min-h-[44px] text-fg-muted hover:text-accent transition-colors rounded-full hover:bg-accent-soft"
                  aria-label="Instalar app"
                >
                  <DownloadIcon className="w-4 h-4" />
                </button>
              )}

              {!isStandalone && (
                <a
                  href="https://play.google.com/store/apps/details?id=com.javipaurdev.gasteizclick"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden md:flex p-2.5 min-w-[44px] min-h-[44px] text-fg-muted hover:text-fg transition-colors rounded-full hover:bg-bg-muted"
                  aria-label="App Android"
                >
                  <PlayStoreIcon className="w-4 h-4" />
                </a>
              )}

              <button
                ref={menuButtonRef}
                className="md:hidden relative w-11 h-11 flex items-center justify-center rounded-full bg-bg-muted border border-border text-fg-muted hover:text-fg transition-all duration-300"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                aria-label={isMenuOpen ? "Cerrar menú" : "Abrir menú"}
                aria-expanded={isMenuOpen}
              >
                <span className="absolute inset-0 flex items-center justify-center transition-all duration-[600ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
                  style={{ opacity: isMenuOpen ? 0 : 1, transform: isMenuOpen ? 'rotate(90deg) scale(0.8)' : 'rotate(0deg) scale(1)' }}
                >
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-5 h-5">
                    <path d="M3 6h14M3 10h14M3 14h14" />
                  </svg>
                </span>
                <span className="absolute inset-0 flex items-center justify-center transition-all duration-[600ms] ease-[cubic-bezier(0.32,0.72,0,1)]"
                  style={{ opacity: isMenuOpen ? 1 : 0, transform: isMenuOpen ? 'rotate(0deg) scale(1)' : 'rotate(-90deg) scale(0.8)' }}
                >
                  <CloseIcon className="w-5 h-5" />
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div
        ref={menuOverlayRef}
        className={`fixed inset-0 z-[var(--z-modal-backdrop)] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          isMenuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        style={{ backgroundColor: 'rgba(26, 24, 22, 0.85)', backdropFilter: 'blur(48px)', WebkitBackdropFilter: 'blur(48px)' }}
        onClick={() => setIsMenuOpen(false)}
      >
        <nav
          className="flex flex-col items-center justify-center h-full px-6"
          aria-label="Navegación móvil"
          onClick={(e) => e.stopPropagation()}
        >
          <form onSubmit={handleSearch} className="w-full max-w-sm mb-10" role="search">
            <div className="relative">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40 pointer-events-none" />
              <input
                type="search"
                placeholder="Buscar eventos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 text-base bg-white/10 rounded-2xl border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:border-white/40 transition-all duration-300"
                aria-label="Buscar eventos"
              />
            </div>
          </form>

          <ul className="flex flex-col items-stretch gap-1.5 w-full max-w-sm">
            {visibleNavItems.map((item, i) => {
              const isActive = pathname === item.href;
              return (
                <li
                  key={item.href}
                  style={{
                    transition: `all 0.6s cubic-bezier(0.32,0.72,0,1) ${i * 0.07}s`,
                    opacity: isMenuOpen ? 1 : 0,
                    transform: isMenuOpen ? 'translateY(0)' : 'translateY(24px)',
                  }}
                >
                  <Link
                    href={item.href}
                    onClick={() => setIsMenuOpen(false)}
                    aria-current={isActive ? "page" : undefined}
                    className={`block w-full text-center py-3.5 text-xl font-display rounded-xl transition-all duration-300 ${
                      isActive
                        ? "text-accent bg-white/10 font-bold"
                        : "text-white/70 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {item.name}
                  </Link>
                </li>
              );
            })}
            <li
              className="mt-3"
              style={{
                transition: `all 0.6s cubic-bezier(0.32,0.72,0,1) ${visibleNavItems.length * 0.07}s`,
                opacity: isMenuOpen ? 1 : 0,
                transform: isMenuOpen ? 'translateY(0)' : 'translateY(24px)',
              }}
            >
              <Link
                href="/favoritos"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center justify-center gap-3 w-full text-center py-3.5 text-xl font-display text-white/70 hover:text-white hover:bg-white/5 rounded-xl transition-all duration-300"
              >
                <Heart size={20} strokeWidth={1.5} />
                Favoritos
                {count > 0 && (
                  <span className="bg-accent text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                    {count}
                  </span>
                )}
              </Link>
            </li>
            {!isStandalone && (
              <li
                style={{
                  transition: `all 0.6s cubic-bezier(0.32,0.72,0,1) ${(visibleNavItems.length + 1) * 0.07}s`,
                  opacity: isMenuOpen ? 1 : 0,
                  transform: isMenuOpen ? 'translateY(0)' : 'translateY(24px)',
                }}
              >
                <a
                  href="https://play.google.com/store/apps/details?id=com.javipaurdev.gasteizclick"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center justify-center gap-3 w-full text-center py-3 text-sm text-white/40 hover:text-white/60 rounded-xl transition-all duration-300"
                >
                  <PlayStoreIcon className="w-4 h-4" />
                  App Android
                </a>
              </li>
            )}
          </ul>
        </nav>
      </div>
    </>
  );
}
