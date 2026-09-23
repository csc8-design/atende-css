import { useState, useEffect, useCallback } from "react";

export type ThemeMode = "light" | "dark" | "auto";

export interface AccentColor {
  name: string;
  label: string;
  hsl: string; // e.g. "210 100% 50%"
}

export const ACCENT_COLORS: AccentColor[] = [
  { name: "blue", label: "Azul", hsl: "217 91% 60%" },
  { name: "green", label: "Verde", hsl: "142 71% 45%" },
  { name: "purple", label: "Roxo", hsl: "263 70% 58%" },
  { name: "red", label: "Vermelho", hsl: "0 84% 60%" },
  { name: "orange", label: "Laranja", hsl: "25 95% 53%" },
  { name: "pink", label: "Rosa", hsl: "330 81% 60%" },
  { name: "teal", label: "Teal", hsl: "173 80% 40%" },
  { name: "yellow", label: "Amarelo", hsl: "48 96% 53%" },
];

const STORAGE_KEY = "app-theme";
const ACCENT_STORAGE_KEY = "app-accent-color";

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(mode: ThemeMode) {
  const resolved = mode === "auto" ? getSystemTheme() : mode;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

function applyAccentColor(hsl: string) {
  document.documentElement.style.setProperty("--primary", hsl);
  // Generate a lighter foreground for contrast on the primary color
  document.documentElement.style.setProperty("--primary-foreground", "0 0% 100%");
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem(STORAGE_KEY) as ThemeMode) || "light";
  });

  const [accentColor, setAccentColorState] = useState<string>(() => {
    return localStorage.getItem(ACCENT_STORAGE_KEY) || "blue";
  });

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
    localStorage.setItem(STORAGE_KEY, mode);
    applyTheme(mode);
  }, []);

  const setAccentColor = useCallback((colorName: string) => {
    setAccentColorState(colorName);
    localStorage.setItem(ACCENT_STORAGE_KEY, colorName);
    const color = ACCENT_COLORS.find(c => c.name === colorName);
    if (color) applyAccentColor(color.hsl);
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Apply accent color on mount
  useEffect(() => {
    const color = ACCENT_COLORS.find(c => c.name === accentColor);
    if (color) applyAccentColor(color.hsl);
  }, [accentColor]);

  // Listen for system theme changes when in auto mode
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (theme === "auto") applyTheme("auto");
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [theme]);

  return { theme, setTheme, accentColor, setAccentColor };
}
