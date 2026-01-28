import { useCallback, useSyncExternalStore } from "react";

const THEME_KEY = "theme";

type ThemePreference = "light" | "dark" | "system";

interface ThemeState {
  theme: ThemePreference;
  darkMode: boolean;
}

// Get system preference
const getSystemPreference = (): boolean => {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
};

// Get saved theme preference
const getSavedTheme = (): ThemePreference => {
  if (typeof window === "undefined") return "system";
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark" || saved === "system") {
    return saved;
  }
  return "system";
};

// Calculate actual dark mode based on preference
const calculateDarkMode = (theme: ThemePreference): boolean => {
  if (theme === "system") {
    return getSystemPreference();
  }
  return theme === "dark";
};

// Update DOM classes
const updateDOM = (isDark: boolean): void => {
  const root = document.documentElement;
  root.classList.toggle("dark", isDark);
};

// Unified state object for atomic updates
let state: ThemeState = {
  theme: getSavedTheme(),
  darkMode: false, // Will be set in init
};

// Initialize darkMode based on theme
state.darkMode = calculateDarkMode(state.theme);

const listeners = new Set<() => void>();

const emitChange = (): void => {
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = (): ThemeState => state;

const getServerSnapshot = (): ThemeState => ({
  theme: "system",
  darkMode: true,
});

const setThemePreference = (theme: ThemePreference): void => {
  const newDarkMode = calculateDarkMode(theme);

  // Create new state object for React to detect change
  state = {
    theme,
    darkMode: newDarkMode,
  };

  localStorage.setItem(THEME_KEY, theme);
  updateDOM(newDarkMode);
  emitChange();
};

// Initialize DOM and listeners
if (typeof window !== "undefined") {
  updateDOM(state.darkMode);

  // Listen for system theme changes
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", (e) => {
    if (state.theme === "system") {
      state = { ...state, darkMode: e.matches };
      updateDOM(e.matches);
      emitChange();
    }
  });

  // Listen for storage changes from other tabs
  window.addEventListener("storage", (e) => {
    if (e.key === THEME_KEY && e.newValue) {
      const newTheme = e.newValue as ThemePreference;
      if (newTheme !== state.theme) {
        const newDarkMode = calculateDarkMode(newTheme);
        state = { theme: newTheme, darkMode: newDarkMode };
        updateDOM(newDarkMode);
        emitChange();
      }
    }
  });
}

export function useDarkMode() {
  const { theme, darkMode } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const toggleDarkMode = useCallback(() => {
    setThemePreference(darkMode ? "light" : "dark");
  }, [darkMode]);

  const setDarkMode = useCallback((value: boolean) => {
    setThemePreference(value ? "dark" : "light");
  }, []);

  const setTheme = useCallback((value: ThemePreference) => {
    setThemePreference(value);
  }, []);

  return { darkMode, theme, toggleDarkMode, setDarkMode, setTheme };
}