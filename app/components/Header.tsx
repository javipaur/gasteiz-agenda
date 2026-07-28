"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import { Heart } from "lucide-react";
import { useFavorites } from "@/app/context/FavoritesContext";

const navItems = [
  { name: "Inicio", href: "/" },
  { name: "La Blanca", href: "/fiestas-blanca", accent: true },
  { name: "Conciertos", href: "/conciertos" },
  { name: "Cartelera", href: "/movies" },
  { name: "Niños", href: "/kids" },
  { name: "Cultura", href: "/culture" },
  { name: "Deporte", href: "/deporte" },
];

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
  const [scrolled, setScrolled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const { count } = useFavorites();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isMenuOpen]);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

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

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    router.push(`/culture?q=${encodeURIComponent(q)}`);
    setSearchQuery("");
    setSearchOpen(false);
    setIsMenuOpen(false);
  }, [searchQuery, router]);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  return (
    <>
      <header
        className={`fixed left-0 right-0 z-[var(--z-nav)] transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          scrolled ? "mt-0" : "mt-0 md:mt-4"
        }`}
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <div className={`
          mx-auto transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]
          ${scrolled
            ? "max-w-full rounded-none bg-bg/90 backdrop-blur-xl border-b border-border"
            : "max-w-[calc(100%-2rem)] lg:max-w-5xl rounded-full bg-bg/90 backdrop-blur-xl border border-border shadow-sm"
          }
        `}>
          <div className="flex items-center justify-between px-4 md:px-6 py-2.5 md:py-2">
            <Link
              href="/"
              className="font-display text-lg md:text-xl font-bold tracking-tight text-accent hover:text-accent-hover transition-colors duration-300 shrink-0"
            >
              Gasteiz Click
            </Link>

            <nav className="hidden md:flex items-center gap-0.5 mx-2" aria-label="Navegación principal">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-1.5 text-sm whitespace-nowrap rounded-full transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                      isActive
                        ? item.accent
                          ? "bg-amber-500/15 text-amber-600 font-medium"
                          : "bg-accent-soft text-accent font-medium"
                        : item.accent
                          ? "text-amber-600 hover:bg-amber-500/10 font-medium"
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
                    className="w-full pl-9 pr-3 py-1.5 text-sm bg-bg-muted border border-border text-fg placeholder:text-fg-subtle focus:outline-none focus:border-accent transition-all duration-300"
                    style={{ borderRadius: '999px' }}
                    aria-label="Buscar eventos"
                  />
                  <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle pointer-events-none" />
                </div>
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

              {deferredPrompt && (
                <button
                  onClick={handleInstall}
                  className="hidden md:flex p-2.5 min-w-[44px] min-h-[44px] text-fg-muted hover:text-accent transition-colors rounded-full hover:bg-accent-soft"
                  aria-label="Instalar app"
                >
                  <DownloadIcon className="w-4 h-4" />
                </button>
              )}

              <a
                href="https://play.google.com/store/apps/details?id=com.javipaurdev.gasteizclick"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden md:flex p-2.5 min-w-[44px] min-h-[44px] text-fg-muted hover:text-fg transition-colors rounded-full hover:bg-bg-muted"
                aria-label="App Android"
              >
                <PlayStoreIcon className="w-4 h-4" />
              </a>

              <button
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
            {navItems.map((item, i) => {
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
                    className={`block w-full text-center py-3.5 text-xl font-display rounded-xl transition-all duration-300 ${
                      isActive
                        ? item.accent
                          ? "text-amber-400 bg-white/10 font-bold"
                          : "text-accent bg-white/10 font-bold"
                        : item.accent
                          ? "text-amber-400/80 hover:text-amber-300 hover:bg-white/5 font-medium"
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
                transition: `all 0.6s cubic-bezier(0.32,0.72,0,1) ${navItems.length * 0.07}s`,
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
            <li
              style={{
                transition: `all 0.6s cubic-bezier(0.32,0.72,0,1) ${(navItems.length + 1) * 0.07}s`,
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
          </ul>
        </nav>
      </div>
    </>
  );
}
