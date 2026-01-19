import { useCallback, useSyncExternalStore } from "react";

const THEME_KEY = "theme"; // "light" | "dark" | "system"

type ThemePreference = "light" | "dark" | "system";

// Get system preference
function getSystemPreference(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// Get saved theme preference
function getSavedTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark" || saved === "system") {
    return saved;
  }
  return "system";
}

// Calculate actual dark mode based on preference
function calculateDarkMode(theme: ThemePreference): boolean {
  if (theme === "system") {
    return getSystemPreference();
  }
  return theme === "dark";
}

// Shared state
let themePreference: ThemePreference = getSavedTheme();
let darkModeValue = calculateDarkMode(themePreference);
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return darkModeValue;
}

function getThemeSnapshot() {
  return themePreference;
}

function getServerSnapshot() {
  return true;
}

function getServerThemeSnapshot() {
  return "system" as ThemePreference;
}

function updateDOM(isDark: boolean) {
  const root = document.documentElement;
  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

function setThemePreference(theme: ThemePreference) {
  themePreference = theme;
  localStorage.setItem(THEME_KEY, theme);
  
  const newDarkMode = calculateDarkMode(theme);
  if (darkModeValue !== newDarkMode) {
    darkModeValue = newDarkMode;
    updateDOM(darkModeValue);
  }
  
  // Notify all subscribers
  listeners.forEach((listener) => listener());
}

// Initialize DOM and system preference listener
if (typeof window !== "undefined") {
  updateDOM(darkModeValue);

  // Listen for system theme changes
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  mediaQuery.addEventListener("change", (e) => {
    // Only update if theme is set to "system"
    if (themePreference === "system") {
      darkModeValue = e.matches;
      updateDOM(darkModeValue);
      listeners.forEach((listener) => listener());
    }
  });

  // Listen for storage changes from other tabs
  window.addEventListener("storage", (e) => {
    if (e.key === THEME_KEY && e.newValue !== null) {
      const newTheme = e.newValue as ThemePreference;
      if (newTheme !== themePreference) {
        themePreference = newTheme;
        const newDarkMode = calculateDarkMode(themePreference);
        if (darkModeValue !== newDarkMode) {
          darkModeValue = newDarkMode;
          updateDOM(darkModeValue);
        }
        listeners.forEach((listener) => listener());
      }
    }
  });
}

export function useDarkMode() {
  const darkMode = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const theme = useSyncExternalStore(
    subscribe,
    getThemeSnapshot,
    getServerThemeSnapshot
  );

  const toggleDarkMode = useCallback(() => {
    setThemePreference(darkModeValue ? "light" : "dark");
  }, []);

  const setDarkMode = useCallback((value: boolean) => {
    setThemePreference(value ? "dark" : "light");
  }, []);

  const setTheme = useCallback((value: ThemePreference) => {
    setThemePreference(value);
  }, []);

  return { darkMode, theme, toggleDarkMode, setDarkMode, setTheme };
}