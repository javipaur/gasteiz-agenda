"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

import { readFavorites } from "./favorites-migration";

const STORAGE_KEY = "gasteiz-favorites";

export interface FavoriteEvent {
  /**
   * El slug del evento, y el id es exactamente lo mismo. Antes el id era un UUID
   * que se regeneraba en cada re-scraping, así que los favoritos guardados
   * dejaban de coincidir con nada; ahora ambos campos son el mismo valor y
   * `isFavorite` se puede comparar contra `AgendaEvento.slug` sin ambigüedad.
   */
  id: string;
  slug: string;
  title: string;
  date: string;
  image?: string;
  location?: string;
  link?: string;
}

interface FavoritesContextValue {
  favorites: FavoriteEvent[];
  isFavorite: (id: string) => boolean;
  toggleFavorite: (event: FavoriteEvent) => void;
  count: number;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<FavoriteEvent[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      setFavorites(readFavorites(localStorage.getItem(STORAGE_KEY)));
    } catch {
      // `localStorage` no disponible (modo privado, cookies bloqueadas). El
      // parseo y la migración ya no pueden fallar: viven en `readFavorites`.
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    }
  }, [favorites, loaded]);

  const isFavorite = useCallback(
    (id: string) => favorites.some((f) => f.id === id),
    [favorites]
  );

  const toggleFavorite = useCallback((event: FavoriteEvent) => {
    setFavorites((prev) => {
      const exists = prev.some((f) => f.id === event.id);
      if (exists) {
        return prev.filter((f) => f.id !== event.id);
      }
      return [event, ...prev];
    });
  }, []);

  return (
    <FavoritesContext.Provider
      value={{ favorites, isFavorite, toggleFavorite, count: favorites.length }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) {
    throw new Error("useFavorites must be used within a FavoritesProvider");
  }
  return ctx;
}
