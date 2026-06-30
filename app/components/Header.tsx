"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Menu, X, Heart, Search } from "lucide-react";
import { useFavorites } from "@/app/context/FavoritesContext";

const navItems = [
  { name: "Explore", href: "/" },
  { name: "Cartelera", href: "/movies" },
  { name: "Con niños", href: "/kids" },
  { name: "Cultura", href: "/culture" },
  { name: "Deporte", href: "/deporte" },
];

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { count } = useFavorites();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    router.push(`/culture?q=${encodeURIComponent(q)}`);
    setSearchQuery("");
    setIsMenuOpen(false);
  };

  return (
    <header className="fixed top-0 w-full z-50 bg-paper/80 backdrop-blur-md shadow-sm">
      <div className="flex justify-between items-center px-6 py-4 max-w-7xl mx-auto">
        <Link
          href="/"
          className="font-display text-2xl font-bold tracking-tight text-red hover:text-red-dark transition-colors"
        >
          Gasteiz Click
        </Link>

        <nav className="hidden md:flex gap-6 items-center" aria-label="Navegación principal">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm transition-colors ${
                  isActive
                    ? "text-red font-semibold"
                    : "text-ink-light hover:text-red"
                }`}
              >
                {item.name}
              </Link>
            );
          })}

          <form onSubmit={handleSearch} className="relative mr-2" role="search">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-lighter pointer-events-none" />
            <input
              type="search"
              placeholder="¿Qué buscas?"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-36 lg:w-48 pl-9 pr-3 py-1.5 text-sm bg-paper-dark rounded-full border border-stone text-ink placeholder:text-ink-lighter focus:outline-none focus:border-red focus:ring-1 focus:ring-red transition-colors"
              aria-label="Buscar eventos por título, categoría o ubicación"
            />
          </form>

          <Link
            href="/favoritos"
            className={`relative flex items-center gap-1.5 text-sm transition-colors ${
              pathname === "/favoritos"
                ? "text-red font-semibold"
                : "text-ink-light hover:text-red"
            }`}
          >
            <Heart size={16} />
            <span>Favoritos</span>
            {count > 0 && (
              <span className="absolute -top-2 -right-3 bg-red text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </Link>
          <a
            href="https://play.google.com/store/apps/details?id=com.javipaurdev.gasteizclick"
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink-light hover:text-red transition-colors"
            aria-label="Descargar app en Google Play"
          >
            <svg viewBox="0 0 512 512" className="w-5 h-5" fill="currentColor">
              <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z"/>
            </svg>
          </a>
        </nav>

        <button
          className="md:hidden p-2 rounded-lg text-ink-light hover:bg-paper-dark transition-colors"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label={isMenuOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={isMenuOpen}
        >
          {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {isMenuOpen && (
        <nav
          className="md:hidden bg-paper border-t border-stone px-6 py-4"
          aria-label="Navegación móvil"
        >
          <form onSubmit={handleSearch} className="mb-4" role="search">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-lighter pointer-events-none" />
              <input
                type="search"
                placeholder="¿Qué buscas?"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-paper-dark rounded-full border border-stone text-ink placeholder:text-ink-lighter focus:outline-none focus:border-red focus:ring-1 focus:ring-red transition-colors"
                aria-label="Buscar eventos por título, categoría o ubicación"
              />
            </div>
          </form>

          <ul className="flex flex-col gap-4">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setIsMenuOpen(false)}
                    className={`block text-sm ${
                      isActive
                        ? "text-red font-semibold"
                        : "text-ink-light hover:text-red"
                    }`}
                  >
                    {item.name}
                  </Link>
                </li>
              );
            })}
            <li>
              <Link
                href="/favoritos"
                onClick={() => setIsMenuOpen(false)}
                className={`flex items-center gap-2 text-sm ${
                  pathname === "/favoritos"
                    ? "text-red font-semibold"
                    : "text-ink-light hover:text-red"
                }`}
              >
                <Heart size={16} />
                Favoritos
                {count > 0 && (
                  <span className="bg-red text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center ml-1">
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </Link>
            </li>
            <li>
              <a
                href="https://play.google.com/store/apps/details?id=com.javipaurdev.gasteizclick"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center gap-2 text-sm text-ink-light hover:text-red transition-colors"
              >
                <svg viewBox="0 0 512 512" className="w-4 h-4" fill="currentColor">
                  <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z"/>
                </svg>
                App Android
              </a>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
