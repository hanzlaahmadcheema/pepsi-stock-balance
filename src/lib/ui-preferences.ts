"use client";

import { useSyncExternalStore } from "react";

/* =========================================================================
   OPERATOR PREFERENCES — reading size and day/night screen
   Both live on <html> so the whole app re-scales instantly. This module is
   the single place that reads and writes them, exposed as external stores so
   React re-renders on change without an effect/setState cascade.
   ========================================================================= */

export type TextSize = "medium" | "large" | "largest";
export type Theme = "light" | "dark";

const TEXT_SIZE_KEY = "pepsi_text_size";
const THEME_KEY = "pepsi_theme";

const TEXT_SIZES: TextSize[] = ["medium", "large", "largest"];

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function onChange() {
  emit();
}

/* ---------------------------------------------------------------- text size */

export function getTextSize(): TextSize {
  if (typeof document === "undefined") return "large";
  const attr = document.documentElement.getAttribute("data-text-size");
  return TEXT_SIZES.includes(attr as TextSize) ? (attr as TextSize) : "large";
}

export function setTextSize(size: TextSize) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-text-size", size);
  try {
    localStorage.setItem(TEXT_SIZE_KEY, size);
  } catch {}
  emit();
}

/* ------------------------------------------------------------------- theme */

export function getTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function setTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
  emit();
}

/* ------------------------------------------------------------------- hooks */

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onChange);
  };
}

/** Keeps the reading-size buttons in step with the size actually in effect. */
export function useTextSize(): [TextSize, (size: TextSize) => void] {
  const size = useSyncExternalStore(subscribe, getTextSize, () => "large" as TextSize);
  return [size, setTextSize];
}

/** Keeps the Day/Night button in step with the theme actually in effect. */
export function useTheme(): [Theme, (theme: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "light" as Theme);
  return [theme, setTheme];
}
