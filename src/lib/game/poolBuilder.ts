import { getEntryIdsForCategories } from '@/lib/db/categories';
import { listEntries } from '@/lib/db/entries';
import { getListEntryIds } from '@/lib/db/lists';
import type { CategoryRecord, EntryRecord, GenderFilter } from '@/lib/db/schema';

/** Mindestgroesse fuer eine spielbare Runde (3.5). */
export const MIN_POOL_SIZE = 3;

/** Herkunft der Entries (4.5): gemischt, nur selbst angelegte, nur Promis. */
export type EntryOrigin = 'all' | 'own' | 'celebrity';

export const ENTRY_ORIGINS: readonly EntryOrigin[] = ['all', 'own', 'celebrity'];

export const ENTRY_ORIGIN_LABELS: Record<EntryOrigin, string> = {
  all: 'Eigene und Promis',
  own: 'Nur eigene',
  celebrity: 'Nur Promis',
};

export interface PoolConfig {
  /** null = alle Entries, unabhaengig von Listen. */
  listId: string | null;
  /** Leer = kein Include-Filter. Sonst: Entry muss in mindestens einer davon sein. */
  includeCategoryIds: string[];
  /** Entry darf in keiner davon sein. */
  excludeCategoryIds: string[];
  genderFilter: GenderFilter;
  /** Optional, weil aeltere persistierte Configs das Feld nicht kennen. Fehlt es, gilt 'all'. */
  origin?: EntryOrigin;
}

export const DEFAULT_POOL_CONFIG: PoolConfig = {
  listId: null,
  includeCategoryIds: [],
  excludeCategoryIds: [],
  genderFilter: 'all',
  origin: 'all',
};

/** Fehlendes/unbekanntes origin faellt auf 'all' zurueck statt die Config zu verwerfen. */
export function originOf(config: PoolConfig): EntryOrigin {
  return config.origin && ENTRY_ORIGINS.includes(config.origin) ? config.origin : 'all';
}

export function isPoolConfig(value: unknown): value is PoolConfig {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<PoolConfig>;
  return (
    (candidate.listId === null || typeof candidate.listId === 'string') &&
    Array.isArray(candidate.includeCategoryIds) &&
    Array.isArray(candidate.excludeCategoryIds) &&
    typeof candidate.genderFilter === 'string' &&
    // Abwaertskompatibel: das Feld darf fehlen, nur Unsinn darin ist ein Reject.
    (candidate.origin === undefined || typeof candidate.origin === 'string')
  );
}

/** Loest eine Pool-Konfiguration zu den tatsaechlichen Entries auf. */
export async function resolvePool(config: PoolConfig): Promise<EntryRecord[]> {
  const entries = await listEntries();

  const listIds = config.listId ? new Set(await getListEntryIds(config.listId)) : null;
  const included =
    config.includeCategoryIds.length > 0
      ? await getEntryIdsForCategories(config.includeCategoryIds)
      : null;
  const excluded =
    config.excludeCategoryIds.length > 0
      ? await getEntryIdsForCategories(config.excludeCategoryIds)
      : null;

  const origin = originOf(config);

  return entries.filter((entry) => {
    if (listIds && !listIds.has(entry.id)) return false;
    if (included && !included.has(entry.id)) return false;
    if (excluded && excluded.has(entry.id)) return false;
    if (config.genderFilter !== 'all' && entry.gender !== config.genderFilter) return false;
    if (origin === 'own' && entry.isCelebrity) return false;
    if (origin === 'celebrity' && !entry.isCelebrity) return false;
    return true;
  });
}

/** Menschenlesbarer Pool-Text, wird am RoundRecord mitgespeichert. */
export function describePool(
  config: PoolConfig,
  context: { listName?: string | null; categories?: CategoryRecord[] },
): string {
  const parts: string[] = [context.listName ? context.listName : 'Alle Einträge'];
  const nameOf = (id: string) => context.categories?.find((c) => c.id === id)?.name ?? id;

  if (config.includeCategoryIds.length > 0) {
    parts.push(`nur ${config.includeCategoryIds.map(nameOf).join(', ')}`);
  }
  if (config.excludeCategoryIds.length > 0) {
    parts.push(`ohne ${config.excludeCategoryIds.map(nameOf).join(', ')}`);
  }
  if (config.genderFilter !== 'all') {
    parts.push(`Gender: ${config.genderFilter}`);
  }
  const origin = originOf(config);
  if (origin !== 'all') {
    parts.push(ENTRY_ORIGIN_LABELS[origin].toLocaleLowerCase('de'));
  }
  return parts.join(' · ');
}
