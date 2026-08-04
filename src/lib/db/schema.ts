import type { DBSchema } from 'idb';

/**
 * Datenmodell der lokalen IndexedDB.
 *
 * Bewusst OHNE user_id/Auth-Spalten (kein Backend), aber mit createdAt/updatedAt
 * ueberall, damit ein Sync-Layer spaeter ohne Schema-Rewrite nachruestbar bliebe.
 *
 * WICHTIG zu Indizes: IndexedDB kann weder `null` noch `boolean` als Key
 * indizieren. Deshalb gibt es KEINE Indizes auf `deletedAt` oder `isCelebrity` —
 * beides wird in-memory gefiltert. Die Datenmengen sind klein (ein Nutzer,
 * ein Browser), das ist unkritisch. `tmdbId` ist dagegen eine Zahl und damit
 * indizierbar; Entries ohne tmdbId fallen aus dem Index — genau richtig, denn
 * der Index dient nur der Dedupe-Suche beim Promi-Import.
 */

export type Verdict = 'fuck' | 'marry' | 'kill';
export const VERDICTS: readonly Verdict[] = ['fuck', 'marry', 'kill'];

export type Gender = 'male' | 'female' | 'nonbinary' | 'unspecified';
export const GENDERS: readonly Gender[] = ['male', 'female', 'nonbinary', 'unspecified'];

/** 'all' = kein Filter. Sonst nur Entries mit exakt diesem Gender. */
export type GenderFilter = 'all' | Gender;

export type ThemePreference = 'light' | 'dark' | 'system';

/** Position der Karte innerhalb einer Runde. */
export type CardPosition = 0 | 1 | 2;

export interface EntryRecord {
  id: string;
  name: string;
  /** Verweis auf photos.id — der Blob liegt separat, damit Listen keine Blobs deserialisieren. */
  photoBlobId?: string;
  gender: Gender;
  note?: string;
  isCelebrity: boolean;
  tmdbId?: number;
  /** Soft-Delete: ISO-String wenn geloescht, sonst null. Nicht indiziert. */
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PhotoRecord {
  id: string;
  blob: Blob;
  createdAt: string;
}

export interface CategoryRecord {
  id: string;
  name: string;
  /** Hex-Farbe, z.B. '#e11d48'. */
  color: string;
  isPremade: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Composite Key [entryId, categoryId]. */
export interface EntryCategoryRecord {
  entryId: string;
  categoryId: string;
}

export interface ListRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/** Composite Key [listId, entryId]. */
export interface ListEntryRecord {
  listId: string;
  entryId: string;
}

export interface RoundRecord {
  id: string;
  listId: string | null;
  /** Menschenlesbare Beschreibung des Pools, aus dem gespielt wurde. */
  poolDescriptor: string;
  playedAt: string;
}

export interface RoundItemRecord {
  id: string;
  roundId: string;
  entryId: string;
  verdict: Verdict;
  position: CardPosition;
}

export interface SettingsRecord {
  id: 'singleton';
  /** Nur Anzeige-Strings: Date/Marry/Dump statt Fuck/Marry/Kill. Verdict-Enum bleibt gleich. */
  safeLabels: boolean;
  genderFilter: GenderFilter;
  theme: ThemePreference;
  locale: 'de' | 'en';
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  updatedAt: string;
}

/** Reserviert fuer offline-Caching roher TMDB-Payloads. Aktuell ungenutzt. */
export interface TmdbCacheRecord {
  tmdbId: number;
  payload: unknown;
  cachedAt: string;
}

export interface FmkDB extends DBSchema {
  entries: {
    key: string;
    value: EntryRecord;
    indexes: { 'by-tmdbId': number };
  };
  photos: {
    key: string;
    value: PhotoRecord;
  };
  categories: {
    key: string;
    value: CategoryRecord;
  };
  entryCategories: {
    key: [string, string];
    value: EntryCategoryRecord;
    indexes: { 'by-entry': string; 'by-category': string };
  };
  lists: {
    key: string;
    value: ListRecord;
  };
  listEntries: {
    key: [string, string];
    value: ListEntryRecord;
    indexes: { 'by-list': string; 'by-entry': string };
  };
  rounds: {
    key: string;
    value: RoundRecord;
    indexes: { 'by-playedAt': string };
  };
  roundItems: {
    key: string;
    value: RoundItemRecord;
    indexes: { 'by-round': string; 'by-entry': string };
  };
  settings: {
    key: string;
    value: SettingsRecord;
  };
  tmdbCache: {
    key: number;
    value: TmdbCacheRecord;
  };
}

export const GENDER_LABELS: Record<Gender, string> = {
  male: 'Männlich',
  female: 'Weiblich',
  nonbinary: 'Nicht-binär',
  unspecified: 'Keine Angabe',
};

export const GENDER_FILTER_LABELS: Record<GenderFilter, string> = {
  all: 'Alle',
  ...GENDER_LABELS,
};
