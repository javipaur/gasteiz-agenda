"use client";

import { useFavorites, type FavoriteEvent } from "@/app/context/FavoritesContext";
import { useToast } from "@/app/context/ToastContext";

interface Props {
  event: FavoriteEvent;
  className?: string;
  size?: "sm" | "md";
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

/**
 * La caja ya no depende del tamaño.
 *
 * `sm` medía 36×36 y `md` 44×44. Se degradan los dos a la misma caja de 44 porque
 * `sm` es el botón de favorito que se pinta encima de la imagen de cada tarjeta,
 * y es el control que más se toca con el pulgar sin querer: 36 px es la zona en la
 * que el navegador amplió el área de acierto y no lo dice en la interfaz. Además,
 * el botón de compartir que tiene al lado en `lib/shared.tsx` sigue en 36, así que
 * bajarlo además dejaba la pareja desigual.
 *
 * `size` sigue declarándose porque lo que sí cambia entre `sm` y `md` es el icono.
 */
const caja = {
  sm: "w-11 h-11",
  md: "w-11 h-11",
} as const;

export default function FavoriteButton({ event, className = "", size = "md" }: Props) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const toast = useToast();
  const fav = isFavorite(event.id);
  const box = caja[size];
  const icon = size === "sm" ? "w-4 h-4" : "w-[18px] h-[18px]";

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof navigator.vibrate === "function") navigator.vibrate(10);
        toggleFavorite(event);
        if (toast) {
          if (fav) {
            toast.showToast("Eliminado de favoritos");
          } else {
            toast.showToast("Añadido a favoritos", { href: "/favoritos", label: "Ver" });
          }
        }
      }}
      aria-label={fav ? "Quitar de favoritos" : "Añadir a favoritos"}
      className={`z-10 flex items-center justify-center ${box} rounded-full backdrop-blur-xl transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:scale-110 active:scale-[0.92] ${fav ? "bg-white/30 text-accent" : "bg-black/30 text-white/80 hover:text-white hover:bg-black/50"} ${className}`}
      style={{ boxShadow: fav ? '0 0 12px rgba(201, 74, 61, 0.35)' : 'inset 0 1px 0 rgba(255,255,255,0.15)' }}
    >
      <HeartIcon filled={fav} className={icon} />
    </button>
  );
}
