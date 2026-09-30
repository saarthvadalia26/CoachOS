"use client";

import * as React from "react";

type Theme = "light" | "dark" | "system";

type ThemeProviderContextType = {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeProviderContext = React.createContext<ThemeProviderContextType>({
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => null,
  toggleTheme: () => null,
});

const STORAGE_KEY = "coachos_theme";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("coachos_theme_change", callback);
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("coachos_theme_change", callback);
    mediaQuery.removeEventListener("change", callback);
  };
}

function getStoredThemeSnapshot(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // localStorage may be unavailable
  }
  return "system";
}

function getSystemDarkSnapshot(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
}) {
  const theme = React.useSyncExternalStore(
    subscribe,
    getStoredThemeSnapshot,
    () => defaultTheme
  );

  const isSystemDark = React.useSyncExternalStore(
    subscribe,
    getSystemDarkSnapshot,
    () => false
  );

  const resolvedTheme: "light" | "dark" =
    theme === "dark" || (theme === "system" && isSystemDark) ? "dark" : "light";

  // Keep DOM root class synchronized
  React.useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [resolvedTheme]);

  const setTheme = React.useCallback((nextTheme: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, nextTheme);
    } catch {
      // Ignore
    }
    window.dispatchEvent(new Event("coachos_theme_change"));
  }, []);

  const toggleTheme = React.useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  return (
    <ThemeProviderContext.Provider
      value={{
        theme,
        resolvedTheme,
        setTheme,
        toggleTheme,
      }}
    >
      {children}
    </ThemeProviderContext.Provider>
  );
}

export function useTheme() {
  return React.useContext(ThemeProviderContext);
}

/**
 * Script injected into <head> to eliminate Flash of Unstyled Theme (FOUT)
 */
export const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem("${STORAGE_KEY}");
    var systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (stored === "dark" || (!stored && systemDark) || (stored === "system" && systemDark)) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  } catch (e) {}
})();
`;
