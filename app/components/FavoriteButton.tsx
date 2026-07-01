"use client";

import { useFavorites, type FavoriteEvent } from "@/app/context/FavoritesContext";

interface Props {
  event: FavoriteEvent;
  className?: string;
}

function HeartIcon({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path
        d="M10 17.5l-1.5-1.3C4.5 12.7 2 10.5 2 7.8 2 5.5 3.8 3.5 6 3.5c1.3 0 2.5.6 3.3 1.5l.7.8.7-.8C11.5 4.1 12.7 3.5 14 3.5c2.2 0 4 2 4 4.3 0 2.7-2.5 4.9-6.5 8.4L10 17.5z"
        fill={filled ? "currentColor" : "none"}
      />
    </svg>
  );
}

export default function FavoriteButton({ event, className = "" }: Props) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const fav = isFavorite(event.id);

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(event);
      }}
      aria-label={fav ? "Quitar de favoritos" : "Añadir a favoritos"}
      className={`z-10 flex items-center justify-center w-9 h-9 rounded-full backdrop-blur-xl transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:scale-110 active:scale-[0.92] ${fav ? "bg-white/30 text-accent" : "bg-black/30 text-white/80 hover:text-white hover:bg-black/50"} ${className}`}
      style={{ boxShadow: fav ? '0 0 12px rgba(201, 74, 61, 0.3)' : 'inset 0 1px 0 rgba(255,255,255,0.15)' }}
    >
      <HeartIcon filled={fav} className="w-[18px] h-[18px]" />
    </button>
  );
}
