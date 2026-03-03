import { useState, useEffect, useCallback, createContext, useContext, createElement, type ReactNode } from 'react';

const FAVORITES_KEY = 'roc_favorites';
const MAX_FAVORITES = 50; // Limit to prevent localStorage bloat

export interface FavoriteCandidate {
  id: string;
  name: string;
  category: string;
  location: string;
}

interface FavoriteService {
  id: string;
  name: string;
  category: string;
  location: string;
  addedAt: number;
}

/**
 * Custom hook for managing favorite services using localStorage
 */
export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteService[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load favorites from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as FavoriteService[];
        setFavorites(parsed);
      }
    } catch (err) {
      console.error('Failed to load favorites from localStorage:', err);
      // Clear corrupted data
      localStorage.removeItem(FAVORITES_KEY);
    }
    setIsLoaded(true);
  }, []);

  // Save favorites to localStorage whenever they change
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
      } catch (err) {
        console.error('Failed to save favorites to localStorage:', err);
      }
    }
  }, [favorites, isLoaded]);

  /**
   * Check if a service is favorited
   */
  const isFavorite = useCallback((serviceId: string): boolean => {
    return favorites.some(f => f.id === serviceId);
  }, [favorites]);

  /**
   * Add a service to favorites
   */
  const addFavorite = useCallback((service: FavoriteCandidate) => {
    setFavorites(prev => {
      // Don't add duplicates
      if (prev.some(f => f.id === service.id)) {
        return prev;
      }

      const newFavorite: FavoriteService = {
        id: service.id,
        name: service.name,
        category: service.category,
        location: service.location,
        addedAt: Date.now(),
      };

      // Enforce max limit (remove oldest if at limit)
      const updated = [newFavorite, ...prev];
      if (updated.length > MAX_FAVORITES) {
        updated.pop();
      }

      return updated;
    });
  }, []);

  /**
   * Remove a service from favorites
   */
  const removeFavorite = useCallback((serviceId: string) => {
    setFavorites(prev => prev.filter(f => f.id !== serviceId));
  }, []);

  /**
   * Toggle favorite status for a service
   */
  const toggleFavorite = useCallback((service: FavoriteCandidate) => {
    if (isFavorite(service.id)) {
      removeFavorite(service.id);
    } else {
      addFavorite(service);
    }
  }, [isFavorite, addFavorite, removeFavorite]);

  /**
   * Clear all favorites
   */
  const clearFavorites = useCallback(() => {
    setFavorites([]);
  }, []);

  /**
   * Get count of favorites
   */
  const favoriteCount = favorites.length;

  /**
   * Get favorite IDs for quick lookup
   */
  const favoriteIds = new Set(favorites.map(f => f.id));

  return {
    favorites,
    favoriteIds,
    favoriteCount,
    isLoaded,
    isFavorite,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    clearFavorites,
  };
}

export type { FavoriteService };

// ============= SHARED CONTEXT =============

interface FavoritesContextValue extends ReturnType<typeof useFavorites> {}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const favorites = useFavorites();
  return createElement(FavoritesContext.Provider, { value: favorites }, children);
}

export function useFavoritesContext(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavoritesContext must be used inside FavoritesProvider');
  return ctx;
}
