import { nowIso } from '@/lib/ids';
import { defaultSettings, getDB } from './client';
import type { SettingsRecord } from './schema';

export async function getSettings(): Promise<SettingsRecord> {
  const db = await getDB();
  const existing = await db.get('settings', 'singleton');
  if (existing) return existing;

  // Sollte durch das Seeding in upgrade() nie passieren — aber ein fehlender
  // Settings-Record darf die App nicht blockieren.
  const fresh = defaultSettings(nowIso());
  await db.put('settings', fresh);
  return fresh;
}

export async function updateSettings(
  patch: Partial<Omit<SettingsRecord, 'id' | 'updatedAt'>>,
): Promise<SettingsRecord> {
  const db = await getDB();
  const current = await getSettings();
  const next: SettingsRecord = { ...current, ...patch, updatedAt: nowIso() };
  await db.put('settings', next);
  return next;
}
