import type { ThemePreference } from '@/lib/db/schema';

/**
 * Source of Truth fuer das Theme ist der settings-Store in IndexedDB. Weil IDB
 * async ist, wuerde das erste Paint immer im falschen Theme passieren (FOUC).
 * Deshalb spiegeln wir die Wahl zusaetzlich in localStorage und wenden sie im
 * Root-Layout per Inline-Script vor dem ersten Paint an.
 */
export const THEME_STORAGE_KEY = 'fmk:theme';

export function readStoredTheme(): ThemePreference | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(THEME_STORAGE_KEY);
  return raw === 'light' || raw === 'dark' || raw === 'system' ? raw : null;
}

export function storeTheme(theme: ThemePreference): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export function prefersDark(): boolean {
  if (typeof matchMedia === 'undefined') return false;
  return matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveDark(theme: ThemePreference): boolean {
  return theme === 'dark' || (theme === 'system' && prefersDark());
}

export function applyTheme(theme: ThemePreference): void {
  const dark = resolveDark(theme);
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
}

/** Laeuft blockierend im <head>, bevor irgendetwas gerendert wird. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;
