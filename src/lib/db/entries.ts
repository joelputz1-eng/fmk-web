import { newId, nowIso } from '@/lib/ids';
import { getDB } from './client';
import type { EntryRecord, Gender } from './schema';

export interface EntryInput {
  name: string;
  gender: Gender;
  note?: string;
  photoBlob?: Blob | null;
  categoryIds?: string[];
}

/** Alle nicht-geloeschten Entries. deletedAt ist nicht indizierbar → in-memory gefiltert. */
export async function listEntries(options?: { includeDeleted?: boolean }): Promise<EntryRecord[]> {
  const db = await getDB();
  const all = await db.getAll('entries');
  const entries = options?.includeDeleted ? all : all.filter((entry) => entry.deletedAt === null);
  return entries.sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

export async function getEntry(id: string): Promise<EntryRecord | undefined> {
  const db = await getDB();
  return db.get('entries', id);
}

export async function getEntriesByIds(ids: string[]): Promise<Map<string, EntryRecord>> {
  const db = await getDB();
  const tx = db.transaction('entries', 'readonly');
  const found = await Promise.all(ids.map((id) => tx.store.get(id)));
  await tx.done;
  const map = new Map<string, EntryRecord>();
  found.forEach((entry) => {
    if (entry) map.set(entry.id, entry);
  });
  return map;
}

export async function savePhoto(blob: Blob): Promise<string> {
  const db = await getDB();
  const id = newId();
  await db.put('photos', { id, blob, createdAt: nowIso() });
  return id;
}

export async function getPhotoBlob(photoBlobId: string): Promise<Blob | undefined> {
  const db = await getDB();
  const record = await db.get('photos', photoBlobId);
  return record?.blob;
}

export async function createEntry(input: EntryInput): Promise<EntryRecord> {
  const db = await getDB();
  const now = nowIso();
  const photoBlobId = input.photoBlob ? await savePhoto(input.photoBlob) : undefined;

  const entry: EntryRecord = {
    id: newId(),
    name: input.name.trim(),
    photoBlobId,
    gender: input.gender,
    note: input.note?.trim() || undefined,
    isCelebrity: false,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const tx = db.transaction(['entries', 'entryCategories'], 'readwrite');
  void tx.objectStore('entries').put(entry);
  for (const categoryId of input.categoryIds ?? []) {
    void tx.objectStore('entryCategories').put({ entryId: entry.id, categoryId });
  }
  await tx.done;
  return entry;
}

/** Bulk-Add (2.5): eine Liste von Namen, ohne Fotos. Gibt die angelegten Entries zurueck. */
export async function createEntriesBulk(
  names: string[],
  options?: { gender?: Gender; categoryIds?: string[] },
): Promise<EntryRecord[]> {
  const db = await getDB();
  const now = nowIso();
  const gender = options?.gender ?? 'unspecified';
  const categoryIds = options?.categoryIds ?? [];

  const entries: EntryRecord[] = names.map((name) => ({
    id: newId(),
    name: name.trim(),
    gender,
    isCelebrity: false,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  }));

  const tx = db.transaction(['entries', 'entryCategories'], 'readwrite');
  for (const entry of entries) {
    void tx.objectStore('entries').put(entry);
    for (const categoryId of categoryIds) {
      void tx.objectStore('entryCategories').put({ entryId: entry.id, categoryId });
    }
  }
  await tx.done;
  return entries;
}

export interface EntryUpdate {
  name?: string;
  gender?: Gender;
  note?: string;
  /** Blob = neues Foto, null = Foto entfernen, undefined = unveraendert. */
  photoBlob?: Blob | null;
  categoryIds?: string[];
}

export async function updateEntry(id: string, patch: EntryUpdate): Promise<EntryRecord> {
  const db = await getDB();
  const current = await db.get('entries', id);
  if (!current) throw new Error(`Eintrag ${id} nicht gefunden.`);

  let photoBlobId = current.photoBlobId;
  if (patch.photoBlob !== undefined) {
    if (current.photoBlobId) await db.delete('photos', current.photoBlobId);
    photoBlobId = patch.photoBlob ? await savePhoto(patch.photoBlob) : undefined;
  }

  const next: EntryRecord = {
    ...current,
    name: patch.name?.trim() ?? current.name,
    gender: patch.gender ?? current.gender,
    note: patch.note !== undefined ? patch.note.trim() || undefined : current.note,
    photoBlobId,
    updatedAt: nowIso(),
  };

  const tx = db.transaction(['entries', 'entryCategories'], 'readwrite');
  void tx.objectStore('entries').put(next);
  if (patch.categoryIds) {
    const store = tx.objectStore('entryCategories');
    const existing = await store.index('by-entry').getAll(id);
    for (const link of existing) {
      void store.delete([link.entryId, link.categoryId]);
    }
    for (const categoryId of patch.categoryIds) {
      void store.put({ entryId: id, categoryId });
    }
  }
  await tx.done;
  return next;
}

/** Soft-Delete (2.4) — die Rundenhistorie bleibt dadurch intakt. */
export async function softDeleteEntry(id: string): Promise<void> {
  const db = await getDB();
  const current = await db.get('entries', id);
  if (!current) return;
  await db.put('entries', { ...current, deletedAt: nowIso(), updatedAt: nowIso() });
}

export async function restoreEntry(id: string): Promise<void> {
  const db = await getDB();
  const current = await db.get('entries', id);
  if (!current) return;
  await db.put('entries', { ...current, deletedAt: null, updatedAt: nowIso() });
}

/**
 * Exportiert, damit der Listen-Import (listImport.ts) denselben Massstab
 * anlegt wie die Duplikat-Warnung. Zwei Stellen mit eigener Meinung darueber,
 * was derselbe Mensch ist, waere die schlimmere Variante.
 */
export function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase('de');
}

/**
 * Duplikat-Warnung (2.7). FEATURES.md sagt "gleicher Name in derselben Liste" —
 * ohne Listenkontext beim Anlegen pruefen wir global ueber alle aktiven Entries,
 * was die Warnung eher zu frueh als zu spaet ausloest.
 */
export async function findDuplicateNames(
  name: string,
  options?: { excludeId?: string },
): Promise<EntryRecord[]> {
  const target = normalizeName(name);
  if (!target) return [];
  const entries = await listEntries();
  return entries.filter(
    (entry) => normalizeName(entry.name) === target && entry.id !== options?.excludeId,
  );
}

/** Kategorie-Zuordnungen fuer viele Entries auf einmal (fuer Listen-Views). */
export async function getCategoryIdsByEntry(): Promise<Map<string, string[]>> {
  const db = await getDB();
  const links = await db.getAll('entryCategories');
  const map = new Map<string, string[]>();
  for (const link of links) {
    const list = map.get(link.entryId);
    if (list) list.push(link.categoryId);
    else map.set(link.entryId, [link.categoryId]);
  }
  return map;
}

export async function getCategoryIdsForEntry(entryId: string): Promise<string[]> {
  const db = await getDB();
  const links = await db.getAllFromIndex('entryCategories', 'by-entry', entryId);
  return links.map((link) => link.categoryId);
}
