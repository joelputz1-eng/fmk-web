'use client';

import { useSettings } from '@/lib/theme/SettingsProvider';
import type { ThemePreference } from '@/lib/db/schema';
import { Loading, Notice, PageHeader } from '@/components/ui/Feedback';
import { Toggle } from '@/components/ui/Toggle';

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: 'light', label: 'Hell' },
  { value: 'dark', label: 'Dunkel' },
  { value: 'system', label: 'System' },
];

export default function SettingsPage() {
  const { settings, ready, update } = useSettings();

  if (!ready) return <Loading label="Lade Einstellungen …" />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Lokal gespeichert" title="Einstellungen" />

      <section className="card p-5">
        <h2 className="display mb-4 text-2xl">Darstellung</h2>
        <div className="inline-flex rounded-xl border border-line p-1">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => void update({ theme: option.value })}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
                settings.theme === option.value
                  ? 'bg-ink text-surface-0'
                  : 'text-dim hover:text-ink'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="card divide-y divide-line p-5">
        <h2 className="display mb-2 text-2xl">Spiel</h2>
        <Toggle
          label="Entschärfte Labels"
          description="Zeigt „Date / Marry / Dump“ statt „Fuck / Marry / Kill“. Ändert nur die Anzeige, nicht die gespeicherten Daten."
          checked={settings.safeLabels}
          onChange={(next) => void update({ safeLabels: next })}
        />
        <Toggle
          label="Ton"
          description="Kurzer Sound bei jeder Zuweisung."
          checked={settings.soundEnabled}
          onChange={(next) => void update({ soundEnabled: next })}
        />
        <Toggle
          label="Vibration"
          description="Nur dort verfügbar, wo der Browser es unterstützt (praktisch: Android)."
          checked={settings.hapticsEnabled}
          onChange={(next) => void update({ hapticsEnabled: next })}
        />
      </section>

      <Notice tone="info">
        Gender-Voreinstellung, Cache leeren und JSON-Export/-Import kommen in Phase 5.
      </Notice>
    </div>
  );
}
