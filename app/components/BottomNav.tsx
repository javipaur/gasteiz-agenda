"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Music, Palette, Clapperboard, Heart } from "lucide-react";
import { useFavorites } from "@/app/context/FavoritesContext";

const tabs = [
  { href: "/", label: "Inicio", Icon: Home, exact: true },
  { href: "/conciertos", label: "Conciertos", Icon: Music, exact: false },
  { href: "/culture", label: "Cultura", Icon: Palette, exact: false },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { count } = useFavorites();

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <nav
      aria-label="Navegación inferior"
      className="fixed bottom-0 left-0 right-0 z-[var(--z-nav)] md:hidden"
    >
      <div
        className="bg-bg-elevated/95 backdrop-blur-xl border-t border-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="grid grid-cols-5 max-w-md mx-auto">
          {tabs.map(({ href, label, Icon, exact }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href, exact) ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-1 min-h-[56px] transition-all duration-200 active:scale-[0.94] ${
                isActive(href, exact)
                  ? "text-accent"
                  : "text-fg-muted active:text-fg"
              }`}
            >
              <span
                className={`flex items-center justify-center w-12 h-7 rounded-full transition-colors duration-200 ${
                  isActive(href, exact) ? "bg-accent-soft" : ""
                }`}
              >
                <Icon size={20} strokeWidth={1.5} />
              </span>
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </Link>
          ))}

          <Link
            href="/movies"
            aria-current={pathname.startsWith("/movies") ? "page" : undefined}
            className={`flex flex-col items-center justify-center gap-1 min-h-[56px] transition-all duration-200 active:scale-[0.94] ${
              isActive("/movies", false)
                ? "text-accent"
                : "text-fg-muted active:text-fg"
            }`}
          >
            <span
              className={`flex items-center justify-center w-12 h-7 rounded-full transition-colors duration-200 ${
                isActive("/movies", false) ? "bg-accent-soft" : ""
              }`}
            >
              <Clapperboard size={20} strokeWidth={1.5} />
            </span>
            <span className="text-[10px] font-medium leading-none">Cartelera</span>
          </Link>

          <Link
            href="/favoritos"
            aria-current={pathname.startsWith("/favoritos") ? "page" : undefined}
            className={`relative flex flex-col items-center justify-center gap-1 min-h-[56px] transition-all duration-200 active:scale-[0.94] ${
              isActive("/favoritos", false)
                ? "text-accent"
                : "text-fg-muted active:text-fg"
            }`}
          >
            <span
              className={`flex items-center justify-center w-12 h-7 rounded-full transition-colors duration-200 ${
                isActive("/favoritos", false) ? "bg-accent-soft" : ""
              }`}
            >
              <Heart size={20} strokeWidth={1.5} />
            </span>
            <span className="text-[10px] font-medium leading-none">Favoritos</span>
            {count > 0 && (
              <span className="absolute top-1.5 right-[calc(50%-1.75rem)] bg-accent text-white text-[9px] font-bold min-w-[15px] h-[15px] px-0.5 rounded-full flex items-center justify-center">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </Link>
        </div>
      </div>
    </nav>
  );
}
