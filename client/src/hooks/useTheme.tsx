import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useLocation } from "wouter";

type Theme = "light" | "dark" | "system";
type EffectiveTheme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  effectiveTheme: EffectiveTheme;
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = "admin-theme";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveEffective(theme: Theme): EffectiveTheme {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

function applyDarkClass(effective: EffectiveTheme, isAdmin: boolean) {
  if (effective === "dark" && isAdmin) {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const isAdmin = location.startsWith("/admin");

  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
    return "system";
  });

  const [effectiveTheme, setEffectiveTheme] = useState<EffectiveTheme>(() =>
    resolveEffective(theme)
  );

  const setTheme = useCallback((newTheme: Theme) => {
    localStorage.setItem(STORAGE_KEY, newTheme);
    setThemeState(newTheme);
  }, []);

  // Resolve effective theme when theme or system preference changes
  useEffect(() => {
    const update = () => {
      const effective = resolveEffective(theme);
      setEffectiveTheme(effective);
    };

    update();

    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }
  }, [theme]);

  // Apply/remove dark class based on effective theme and route
  useEffect(() => {
    applyDarkClass(effectiveTheme, isAdmin);
    return () => {
      // Clean up dark class when unmounting (e.g., navigating away)
      document.documentElement.classList.remove("dark");
    };
  }, [effectiveTheme, isAdmin]);

  return (
    <ThemeContext.Provider value={{ theme, effectiveTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
