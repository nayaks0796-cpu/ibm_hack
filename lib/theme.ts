// Theme preference — stored in localStorage, applied to html[data-theme].
// "light" | "dark" | undefined (follow OS).

const KEY = "setu:theme";

export type ThemePreference = "light" | "dark";

export function loadThemePreference(): ThemePreference | null {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    // localStorage unavailable (SSR or private browsing restriction)
  }
  return null;
}

export function saveThemePreference(theme: ThemePreference): void {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // ignore
  }
}

/** Apply data-theme to <html> immediately. Call before first paint. */
export function applyTheme(theme: ThemePreference | null): void {
  if (typeof document === "undefined") return;
  if (theme) {
    document.documentElement.setAttribute("data-theme", theme);
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

/** Read the current effective theme from the DOM. */
export function getEffectiveTheme(): ThemePreference {
  if (typeof document === "undefined") return "light";
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark") return "dark";
  if (attr === "light") return "light";
  // No data-theme — follow OS.
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
