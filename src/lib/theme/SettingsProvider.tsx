'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { defaultSettings } from '@/lib/db/client';
import { getSettings, updateSettings } from '@/lib/db/settings';
import type { SettingsRecord, ThemePreference, Verdict } from '@/lib/db/schema';
import { nowIso } from '@/lib/ids';
import { applyTheme, storeTheme } from './themeScript';

type SettingsPatch = Partial<Omit<SettingsRecord, 'id' | 'updatedAt'>>;

interface SettingsContextValue {
  settings: SettingsRecord;
  /** false, solange die Settings noch aus IndexedDB geladen werden. */
  ready: boolean;
  update: (patch: SettingsPatch) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  // Bewusst ohne localStorage: der Initialwert muss auf Server und Client
  // identisch sein, sonst gibt es einen Hydration-Mismatch. Das sichtbare Theme
  // setzt bis dahin ohnehin das Inline-Script im <head>.
  const [settings, setSettings] = useState<SettingsRecord>(() => defaultSettings(nowIso()));
  const [ready, setReady] = useState(false);

  // Source of Truth nachladen.
  useEffect(() => {
    let cancelled = false;
    getSettings()
      .then((loaded) => {
        if (cancelled) return;
        setSettings(loaded);
        storeTheme(loaded.theme);
        applyTheme(loaded.theme);
      })
      .catch((error) => {
        console.error('Settings konnten nicht geladen werden', error);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Auf Systemwechsel reagieren, solange 'system' aktiv ist.
  useEffect(() => {
    if (settings.theme !== 'system' || typeof matchMedia === 'undefined') return;
    const query = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [settings.theme]);

  const update = useCallback(async (patch: SettingsPatch) => {
    // Optimistisch, damit der Theme-Wechsel nicht auf die DB wartet.
    setSettings((current) => ({ ...current, ...patch, updatedAt: nowIso() }));
    if (patch.theme) {
      storeTheme(patch.theme);
      applyTheme(patch.theme);
    }
    try {
      const saved = await updateSettings(patch);
      setSettings(saved);
    } catch (error) {
      console.error('Settings konnten nicht gespeichert werden', error);
    }
  }, []);

  const value = useMemo(() => ({ settings, ready, update }), [settings, ready, update]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings muss innerhalb von <SettingsProvider> benutzt werden.');
  return ctx;
}

export function useTheme(): [ThemePreference, (theme: ThemePreference) => void] {
  const { settings, update } = useSettings();
  return [settings.theme, (theme) => void update({ theme })];
}

const HARD_LABELS: Record<Verdict, string> = { fuck: 'Fuck', marry: 'Marry', kill: 'Kill' };
const SAFE_LABELS: Record<Verdict, string> = { fuck: 'Date', marry: 'Marry', kill: 'Dump' };

/**
 * Nur die Anzeige-Strings branchen auf safeLabels — der Verdict-Enum in der DB
 * bleibt immer 'fuck' | 'marry' | 'kill'.
 */
export function useVerdictLabels(): Record<Verdict, string> {
  const { settings } = useSettings();
  return settings.safeLabels ? SAFE_LABELS : HARD_LABELS;
}
