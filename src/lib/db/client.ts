import { openDB, type IDBPDatabase } from 'idb';
import { nowIso } from '@/lib/ids';
import type { CategoryRecord, FmkDB, SettingsRecord } from './schema';

export const DB_NAME = 'fmk';
export const DB_VERSION = 2;

/**
 * Premade-Kategorien (FEATURES.md 3.3). Stabile IDs, damit ein spaeterer
 * Export/Import und ein moeglicher Sync sie wiedererkennen.
 */
function premadeCategories(now: string): CategoryRecord[] {
  const defs: Array<[string, string, string]> = [
    ['premade-actors', 'Actors', '#e11d48'],
    ['premade-musicians', 'Musicians', '#8b5cf6'],
    ['premade-athletes', 'Athletes', '#0ea5e9'],
    ['premade-reality-tv', 'Reality TV', '#f59e0b'],
    ['premade-anime', 'Anime', '#ec4899'],
    ['premade-politicians', 'Politicians', '#10b981'],
  ];
  return defs.map(([id, name, color]) => ({
    id,
    name,
    color,
    isPremade: true,
    createdAt: now,
    updatedAt: now,
  }));
}

export function defaultSettings(now: string): SettingsRecord {
  return {
    id: 'singleton',
    safeLabels: false,
    genderFilter: 'all',
    theme: 'system',
    locale: 'de',
    soundEnabled: true,
    hapticsEnabled: true,
    updatedAt: now,
  };
}

let dbPromise: Promise<IDBPDatabase<FmkDB>> | null = null;

/**
 * openDB-Singleton. Nur im Browser aufrufbar — jede Page, die das anfasst,
 * braucht 'use client'.
 */
export function getDB(): Promise<IDBPDatabase<FmkDB>> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB ist nur im Browser verfügbar.'));
  }
  if (!dbPromise) {
    dbPromise = openDB<FmkDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, tx) {
        // Migrations-Seam: kuenftige Versionen haengen hier weitere if-Bloecke an.
        if (oldVersion < 1) {
          db.createObjectStore('entries', { keyPath: 'id' });
          db.createObjectStore('photos', { keyPath: 'id' });
          db.createObjectStore('categories', { keyPath: 'id' });

          const entryCategories = db.createObjectStore('entryCategories', {
            keyPath: ['entryId', 'categoryId'],
          });
          entryCategories.createIndex('by-entry', 'entryId');
          entryCategories.createIndex('by-category', 'categoryId');

          db.createObjectStore('lists', { keyPath: 'id' });

          const listEntries = db.createObjectStore('listEntries', {
            keyPath: ['listId', 'entryId'],
          });
          listEntries.createIndex('by-list', 'listId');
          listEntries.createIndex('by-entry', 'entryId');

          const rounds = db.createObjectStore('rounds', { keyPath: 'id' });
          rounds.createIndex('by-playedAt', 'playedAt');

          const roundItems = db.createObjectStore('roundItems', { keyPath: 'id' });
          roundItems.createIndex('by-round', 'roundId');
          roundItems.createIndex('by-entry', 'entryId');

          db.createObjectStore('settings', { keyPath: 'id' });
          db.createObjectStore('tmdbCache', { keyPath: 'tmdbId' });

          const now = nowIso();
          const categoryStore = tx.objectStore('categories');
          for (const category of premadeCategories(now)) {
            void categoryStore.put(category);
          }
          void tx.objectStore('settings').put(defaultSettings(now));
        }

        // v2: Dedupe-Index fuer den Promi-Import. Bestehende Entries behalten
        // ihre Daten, sie tauchen mangels tmdbId nur nicht im Index auf.
        if (oldVersion < 2) {
          tx.objectStore('entries').createIndex('by-tmdbId', 'tmdbId');
        }
      },
      blocking() {
        // Ein anderer Tab will migrieren — Verbindung freigeben.
        void dbPromise?.then((db) => db.close());
        dbPromise = null;
      },
    });
  }
  return dbPromise;
}
