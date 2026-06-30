"use client";

import { useFavorites, type FavoriteEvent } from "@/app/context/FavoritesContext";
import { Heart } from "lucide-react";

interface Props {
  event: FavoriteEvent;
  className?: string;
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
      className={`z-10 flex items-center justify-center w-9 h-9 rounded-full backdrop-blur-sm transition-all duration-200 hover:scale-110 ${fav ? "bg-white/30 text-red" : "bg-black/30 text-white/80 hover:text-white hover:bg-black/50"} ${className}`}
    >
      <Heart size={18} fill={fav ? "currentColor" : "none"} />
    </button>
  );
}
