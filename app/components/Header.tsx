"use client";

import Link from "next/link";
import Image from "next/image";
import { propsImagen } from "@/lib/image-proxy";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Heart,
  Sparkles,
  CalendarDays,
  CalendarRange,
  Music,
  Drama,
  Frame,
  Clapperboard,
  Baby,
  PartyPopper,
  Compass,
  UtensilsCrossed,
  Trophy,
  Bus,
  Pill,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";
import { useFavorites } from "@/app/context/FavoritesContext";
import { formatDate } from "@/lib/utils";
import { isBlancaSeason } from "@/lib/blanca";
import { CATEGORY_COLORS } from "@/lib/categories";
import { useInstallPrompt, promptInstall, useInstalado } from "@/lib/useInstallPrompt";
import { esIOS } from "@/lib/install";
import { ejecutarAtajo, useAtajoBusqueda } from "@/lib/search-shortcut";
import ShortcutHint from "./ShortcutHint";
import { LogoMarkReducido } from "./LogoMarkReducido";

type SearchHit = {
  slug: string;
  title: string;
  date: string;
  image?: string;
  location?: string;
};

const navItems = [
  { name: "Inicio", href: "/" },
  { name: "Recomendados", href: "/hoy" },
  { name: "La Blanca", href: "/fiestas-blanca", accent: true },
  { name: "Conciertos", href: "/conciertos" },
  { name: "Cultura", href: "/culture" },
  { name: "Deporte", href: "/deporte" },
  { name: "Cartelera", href: "/movies" },
  { name: "Niños", href: "/kids" },
];

/** Id estable del panel, para que el botón pueda apuntarlo con `aria-controls`. */
const EXPLORAR_PANEL_ID = "explorar-panel";

type ExplorarItem = {
  label: string;
  href: string;
  hint: string;
  icon: LucideIcon;
  /** Clave en `CATEGORY_COLORS` o color directo para el acento visual. */
  colorKey?: string;
  color?: string;
};

type ExplorarGrupo = {
  titulo: string;
  items: ExplorarItem[];
};

function getExplorarGrupos(agendaMensualHref: string): ExplorarGrupo[] {
  return [
    {
      titulo: "Agenda",
      items: [
        { label: "Recomendados", href: "/hoy", hint: "Lo mejor de hoy", icon: Sparkles, colorKey: "Otros" },
        { label: "Agenda mensual", href: agendaMensualHref, hint: "Todo el mes", icon: CalendarRange, color: "var(--blue)" },
        { label: "Agenda cultural", href: "/culture/agenda", hint: "Cultura y planes", icon: CalendarDays, colorKey: "Conferencias" },
      ],
    },
    {
      titulo: "Cultura y ocio",
      items: [
        { label: "Conciertos", href: "/conciertos", hint: "Música en vivo", icon: Music, colorKey: "Música" },
        { label: "Teatro", href: "/culture/teatro", hint: "Escena y funciones", icon: Drama, colorKey: "Teatro" },
        { label: "Exposiciones", href: "/culture/exposiciones", hint: "Muestras y arte", icon: Frame, colorKey: "Exposiciones" },
        { label: "Cine", href: "/movies", hint: "Cartelera", icon: Clapperboard, colorKey: "Cine" },
        { label: "Infantil", href: "/kids", hint: "Planes en familia", icon: Baby, colorKey: "Infantil" },
        { label: "Fiestas", href: "/fiestas-blanca", hint: "La Blanca y más", icon: PartyPopper, colorKey: "Fiestas" },
        { label: "Turismo", href: "/turismo", hint: "Qué ver", icon: Compass, colorKey: "Visitas" },
        { label: "Gastronomía", href: "/gastronomia", hint: "Pintxos y sitios", icon: UtensilsCrossed, colorKey: "Gastronomía" },
      ],
    },
    {
      titulo: "Activo",
      items: [
        { label: "Deporte", href: "/deporte", hint: "Eventos y carreras", icon: Trophy, colorKey: "Deporte" },
      ],
    },
  ];
}

function getExplorarUtilidades(): ExplorarItem[] {
  return [
    { label: "Bus y tranvía", href: "/bus", hint: "Paradas y tiempos", icon: Bus, color: "var(--teal)" },
    { label: "Farmacias", href: "/farmacias", hint: "Guardias y horarios", icon: Pill, color: "var(--lime)" },
  ];
}

function colorDeItem(item: ExplorarItem): string {
  if (item.color) return item.color;
  if (item.colorKey) return CATEGORY_COLORS[item.colorKey] || "var(--accent)";
  return "var(--accent)";
}

function getVisibleNavItems() {
  return isBlancaSeason()
    ? navItems
    : navItems.filter((item) => !item.accent);
}

/**
 * Accesos rápidos de la barra superior. El menú «Explorar» ya reúne toda la
 * navegación; aquí solo quedan los destinos principales para no duplicar ni
 * saturar la cabecera en escritorio.
 */
function getQuickNavItems() {
  const hrefs = new Set(["/", "/hoy", "/conciertos", "/culture", "/movies"]);
  return getVisibleNavItems().filter((item) => item.accent || hrefs.has(item.href));
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" focusable="false" className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3v10M6 9l4 4 4-4" />
      <path d="M3 14v2a1 1 0 001 1h12a1 1 0 001-1v-2" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" focusable="false" className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="8" cy="8" r="5.5" />
      <path d="M12.5 12.5L17 17" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" focusable="false" className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M5 5l10 10M15 5l-10 10" />
    </svg>
  );
}

function PlayStoreIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" focusable="false" className={className} viewBox="0 0 512 512" fill="currentColor">
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
  // El store vive en `lib/useInstallPrompt.ts` y no aquí. Estaba escrito en este
  // componente y `InstallBanner` no lo consultaba, con lo que un usuario con la
  // PWA instalada seguía viendo el banner pidiéndole instalarla.
  const isStandalone = useInstalado();
  const [esDispositivoIOS, setEsDispositivoIOS] = useState(false);

  useEffect(() => {
    // Detección de plataforma solo en cliente para ocultar el enlace a Play Store en iOS.
    setEsDispositivoIOS(esIOS(navigator.userAgent, navigator.maxTouchPoints));
  }, []);
  const { count } = useFavorites();
  const quickNavItems = getQuickNavItems();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchFormRef = useRef<HTMLFormElement>(null);
  const explorarRef = useRef<HTMLDivElement>(null);
  const explorarBotonRef = useRef<HTMLButtonElement>(null);
  const [explorarOpen, setExplorarOpen] = useState(false);
  const now = new Date();
  const agendaMensualHref = `/agenda/${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const explorarGrupos = getExplorarGrupos(agendaMensualHref);
  const explorarUtilidades = getExplorarUtilidades();

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
        // El atajo **no** lo atiende este componente: lo atiende quien deba, y
        // aquí solo se escucha la tecla. Con los dos escuchando, el `Header` y el
        // `HeroSearch` abría cada uno su panel y el foco acababa en el input que
        // no era. El motivo está en `lib/search-shortcut.ts`.
        ejecutarAtajo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Este buscador se apunta al registro del atajo. En la portada hay otro más
  // abajo —el del hero— y ese manda mientras esté montado, porque es el que la
  // persona tiene delante.
  useAtajoBusqueda(() => {
    setSearchOpen(true);
  });

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
      if (explorarRef.current && !explorarRef.current.contains(e.target as Node)) {
        setExplorarOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setExplorarOpen(false);
      explorarBotonRef.current?.focus();
    }
    if (explorarOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", onKey);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", onKey);
      };
    }
  }, [explorarOpen]);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    router.push(`/buscar?q=${encodeURIComponent(q)}`);
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
              {/* La variante reducida, no la completa. Este logo se pintaba a
                  `w-6 h-6`, que son 24 px, y a ese tamaño la marca completa pierde
                  la nota, la gilda y el cursor: medido rasterizando el SVG, a 24 px
                  solo sobreviven la G, la txapela y la raya del pincho. Los iconos
                  del PWA, que se ven a 192 px, siguen con la completa. */}
              <LogoMarkReducido className="w-6 h-6 md:w-7 md:h-7 shrink-0" />
              <span className="font-display text-lg md:text-xl font-semibold tracking-tight leading-none">
                Gasteiz<span className="text-accent">Click</span>
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-0.5 mx-2" aria-label="Navegación principal">
              <div ref={explorarRef} className="relative">
                <button
                  ref={explorarBotonRef}
                  onClick={() => setExplorarOpen((v) => !v)}
                  aria-expanded={explorarOpen}
                  aria-controls={EXPLORAR_PANEL_ID}
                  aria-haspopup="true"
                  className={`px-3 py-1.5 text-sm whitespace-nowrap rounded-full transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] cursor-pointer inline-flex items-center gap-1.5 ${
                    explorarOpen
                      ? "bg-fg text-bg font-medium"
                      : "text-fg-muted hover:text-fg hover:bg-bg-muted"
                  }`}
                >
                  <LayoutGrid size={14} strokeWidth={1.75} aria-hidden="true" />
                  Explorar
                  <svg
                    className={`w-3 h-3 transition-transform duration-300 ${explorarOpen ? "rotate-180" : ""}`}
                    viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path d="M4 6l4 4 4-4" />
                  </svg>
                </button>

                {explorarOpen && (
                  <div
                    id={EXPLORAR_PANEL_ID}
                    className="absolute left-0 top-full mt-2 w-[min(640px,calc(100vw-2rem))] rounded-2xl border border-border bg-bg-elevated shadow-xl overflow-hidden z-[var(--z-dropdown)] animate-scaleIn"
                  >
                    <div className="p-3 md:p-4 max-h-[70vh] overflow-y-auto">
                      {explorarGrupos.map((grupo) => (
                        <section key={grupo.titulo} className="mb-4 last:mb-0">
                          <p
                            id={`${EXPLORAR_PANEL_ID}-${grupo.titulo.toLowerCase().replace(/\s+/g, "-")}`}
                            className="px-1 pb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-fg-subtle"
                          >
                            {grupo.titulo}
                          </p>
                          <ul
                            className="grid grid-cols-2 gap-2"
                            aria-labelledby={`${EXPLORAR_PANEL_ID}-${grupo.titulo.toLowerCase().replace(/\s+/g, "-")}`}
                          >
                            {grupo.items.map((item) => {
                              const Icon = item.icon;
                              const color = colorDeItem(item);
                              return (
                                <li key={item.href + item.label}>
                                  <Link
                                    href={item.href}
                                    onClick={() => setExplorarOpen(false)}
                                    className="group flex items-center gap-3 rounded-xl border border-border/60 bg-surface/50 hover:bg-bg-muted hover:border-border px-3 py-2.5 transition-all duration-200"
                                  >
                                    <span
                                      className="grid size-9 shrink-0 place-items-center rounded-lg text-white shadow-sm"
                                      style={{ backgroundColor: color }}
                                      aria-hidden="true"
                                    >
                                      <Icon size={16} strokeWidth={1.75} />
                                    </span>
                                    <span className="min-w-0">
                                      <span className="block text-sm font-medium text-fg leading-tight group-hover:text-accent transition-colors">
                                        {item.label}
                                      </span>
                                      <span className="block text-[11px] text-fg-subtle leading-tight mt-0.5">
                                        {item.hint}
                                      </span>
                                    </span>
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        </section>
                      ))}
                      <section className="mt-3 pt-3 border-t border-border">
                        <p
                          id={`${EXPLORAR_PANEL_ID}-utiles`}
                          className="px-1 pb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-fg-subtle"
                        >
                          Útiles
                        </p>
                        <ul className="grid grid-cols-2 gap-2" aria-labelledby={`${EXPLORAR_PANEL_ID}-utiles`}>
                          {explorarUtilidades.map((item) => {
                            const Icon = item.icon;
                            const color = colorDeItem(item);
                            return (
                              <li key={item.href}>
                                <Link
                                  href={item.href}
                                  onClick={() => setExplorarOpen(false)}
                                  className="group flex items-center gap-3 rounded-xl border border-dashed border-border bg-bg-muted/40 hover:bg-bg-muted hover:border-border-hover px-3 py-2.5 transition-all duration-200"
                                >
                                  <span
                                    className="grid size-9 shrink-0 place-items-center rounded-lg text-white shadow-sm"
                                    style={{ backgroundColor: color }}
                                    aria-hidden="true"
                                  >
                                    <Icon size={16} strokeWidth={1.75} />
                                  </span>
                                  <span className="min-w-0">
                                    <span className="block text-sm font-medium text-fg leading-tight group-hover:text-accent transition-colors">
                                      {item.label}
                                    </span>
                                    <span className="block text-[11px] text-fg-subtle leading-tight mt-0.5">
                                      {item.hint}
                                    </span>
                                  </span>
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      </section>
                    </div>
                  </div>
                )}
              </div>

              {quickNavItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`px-3 py-1.5 text-sm whitespace-nowrap rounded-full transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                      isActive
                        ? "bg-fg text-bg font-medium"
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
                            // En una variable y no dos llamadas en la línea de la
                            // condición: así TypeScript estrecha el spread de `<Image>`,
                            // y una llamada dentro del spread volvería a devolver
                            // `PropsImagen | undefined`.
                            const imagen = propsImagen(hit.image);
                            return (
                              <li key={hit.slug}>
                                <button
                                  type="button"
                                  onClick={() => goToHit(hit.slug)}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-bg-muted transition-colors duration-200 cursor-pointer"
                                >
                                  <span className="relative w-9 h-9 rounded-lg overflow-hidden bg-bg-muted shrink-0 flex items-center justify-center">
                                    {imagen ? (
                                      <Image {...imagen} alt="" fill sizes="36px" className="object-cover" />
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
                          href={`/buscar?q=${encodeURIComponent(searchQuery.trim())}`}
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

              {!isStandalone && !esDispositivoIOS && (
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
                  <svg aria-hidden="true" focusable="false" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="w-5 h-5">
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
          className="flex flex-col items-stretch h-full px-5 sm:px-6 py-20 overflow-y-auto"
          aria-label="Navegación móvil"
          onClick={(e) => e.stopPropagation()}
        >
          <form onSubmit={handleSearch} className="w-full max-w-md mx-auto mb-6" role="search">
            <div className="relative">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70 pointer-events-none" />
              <input
                type="search"
                placeholder="Buscar eventos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 text-base bg-white/10 rounded-2xl border border-white/20 text-white placeholder:text-white/70 focus:outline-none focus:border-white/50 transition-all duration-300"
                aria-label="Buscar eventos"
              />
            </div>
          </form>

          <div className="w-full max-w-md mx-auto">
            <div className="flex items-center justify-between mb-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-white/70">Explorar</p>
              <Link
                href="/"
                onClick={() => setIsMenuOpen(false)}
                className="text-xs font-medium text-white/80 hover:text-white transition-colors"
              >
                Inicio
              </Link>
            </div>

            {explorarGrupos.map((grupo, gi) => (
              <section key={grupo.titulo} className="mb-5">
                <p className="px-1 pb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/70">
                  {grupo.titulo}
                </p>
                <ul className="grid grid-cols-2 gap-2">
                  {grupo.items.map((item, ii) => {
                    const Icon = item.icon;
                    const color = colorDeItem(item);
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                    const delay = 0.03 + (gi * 4 + ii) * 0.03;
                    return (
                      <li
                        key={item.href + item.label}
                        style={{
                          transition: `all 0.5s cubic-bezier(0.32,0.72,0,1) ${delay}s`,
                          opacity: isMenuOpen ? 1 : 0,
                          transform: isMenuOpen ? "translateY(0)" : "translateY(16px)",
                        }}
                      >
                        <Link
                          href={item.href}
                          onClick={() => setIsMenuOpen(false)}
                          aria-current={pathname === item.href ? "page" : undefined}
                          className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 min-h-[52px] transition-all duration-200 ${
                            isActive
                              ? "bg-white/15 border-white/30 text-white"
                              : "bg-white/[0.06] border-white/10 text-white/85 hover:bg-white/10 hover:border-white/20"
                          }`}
                        >
                          <span
                            className="grid size-8 shrink-0 place-items-center rounded-lg text-white"
                            style={{ backgroundColor: color }}
                            aria-hidden="true"
                          >
                            <Icon size={15} strokeWidth={1.75} />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[13px] font-medium leading-tight truncate">{item.label}</span>
                            <span className="block text-[10px] text-white/70 leading-tight mt-0.5 truncate">{item.hint}</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}

            <section className="mb-6 pt-2 border-t border-white/10">
              <p className="px-1 pb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/70">Útiles</p>
              <ul className="grid grid-cols-2 gap-2">
                {explorarUtilidades.map((item, ii) => {
                  const Icon = item.icon;
                  const color = colorDeItem(item);
                  const delay = 0.03 + (explorarGrupos.length * 4 + ii) * 0.03;
                  return (
                    <li
                      key={item.href}
                      style={{
                        transition: `all 0.5s cubic-bezier(0.32,0.72,0,1) ${delay}s`,
                        opacity: isMenuOpen ? 1 : 0,
                        transform: isMenuOpen ? "translateY(0)" : "translateY(16px)",
                      }}
                    >
                      <Link
                        href={item.href}
                        onClick={() => setIsMenuOpen(false)}
                        className="flex items-center gap-2.5 rounded-xl border border-dashed border-white/15 bg-white/[0.04] hover:bg-white/[0.08] px-3 py-2.5 min-h-[52px] transition-all duration-200 text-white/85"
                      >
                        <span
                          className="grid size-8 shrink-0 place-items-center rounded-lg text-white"
                          style={{ backgroundColor: color }}
                          aria-hidden="true"
                        >
                          <Icon size={15} strokeWidth={1.75} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[13px] font-medium leading-tight truncate">{item.label}</span>
                          <span className="block text-[10px] text-white/70 leading-tight mt-0.5 truncate">{item.hint}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>

            <ul className="flex flex-col gap-2 pb-6">
              <li>
                <Link
                  href="/favoritos"
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center justify-center gap-3 w-full text-center py-3.5 text-lg font-display text-white/80 hover:text-white bg-white/[0.06] hover:bg-white/10 rounded-xl border border-white/10 transition-all duration-300"
                >
                  <Heart size={18} strokeWidth={1.5} />
                  Favoritos
                  {count > 0 && (
                    <span className="bg-accent text-white text-xs font-bold min-w-6 h-6 px-1.5 rounded-full flex items-center justify-center">
                      {count}
                    </span>
                  )}
                </Link>
              </li>
              {!isStandalone && (
                <li>
                  <Link
                    href="/instalar"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center justify-center gap-3 w-full text-center py-3 min-h-[44px] text-base text-white/65 hover:text-white hover:bg-white/5 rounded-xl transition-all duration-300"
                  >
                    <DownloadIcon className="w-4 h-4" />
                    Instalar la app
                  </Link>
                </li>
              )}
              {!isStandalone && !esDispositivoIOS && (
                <li>
                  <a
                    href="https://play.google.com/store/apps/details?id=com.javipaurdev.gasteizclick"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center justify-center gap-3 w-full text-center py-3 text-sm text-white/70 hover:text-white rounded-xl transition-all duration-300"
                  >
                    <PlayStoreIcon className="w-4 h-4" />
                    App Android
                  </a>
                </li>
              )}
            </ul>
          </div>
        </nav>
      </div>
    </>
  );
}
