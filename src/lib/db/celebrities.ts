import { newId, nowIso } from '@/lib/ids';
import { processPhoto } from '@/lib/photo/resize';
import { getDB } from './client';
import type { EntryRecord, Gender } from './schema';

/**
 * Promi-Import (4.2/4.3). Ein uebernommener Promi ist danach ein ganz normaler
 * EntryRecord — nur mit isCelebrity/tmdbId und einem lokal gespeicherten Foto.
 * Damit funktioniert er offline, in Filtern, im Spiel und in den Stats, ohne
 * dass irgendwo eine Sonderbehandlung noetig waere.
 */

export interface CelebrityImportInput {
  tmdbId: number;
  name: string;
  gender: Gender;
  /** Volle TMDB-Bild-URL (w500). Fehlt sie, bleibt es beim Initialen-Avatar. */
  profileUrl?: string | null;
  /** Premade-Kategorie aus dem Department-Mapping, falls es eine passende gibt. */
  categoryId?: string | null;
  note?: string;
}

export interface ImportResult {
  entry: EntryRecord;
  /** false = ein vorhandener Eintrag mit dieser tmdbId wurde aktualisiert. */
  created: boolean;
  /** Import hat geklappt, nur das Bild kam nicht durch. */
  photoFailed: boolean;
}

/** Alle Entries mit dieser tmdbId — inklusive soft-geloeschter, sonst dedupliziert es nicht. */
export async function findEntryByTmdbId(tmdbId: number): Promise<EntryRecord | undefined> {
  const db = await getDB();
  return db.getFromIndex('entries', 'by-tmdbId', tmdbId);
}

/** Fuer die Markierung "In deiner Sammlung" im Grid. Geloeschte zaehlen nicht mit. */
export async function getImportedTmdbIds(): Promise<Set<number>> {
  const db = await getDB();
  const entries = await db.getAll('entries');
  const ids = new Set<number>();
  for (const entry of entries) {
    if (entry.tmdbId !== undefined && entry.deletedAt === null) ids.add(entry.tmdbId);
  }
  return ids;
}

/**
 * Bild holen und durch dieselbe Pipeline schicken wie eigene Fotos.
 * image.tmdb.org liefert `Access-Control-Allow-Origin: *`, der Download laeuft
 * deshalb direkt im Browser — kein Proxy noetig.
 */
async function downloadProfilePhoto(url: string): Promise<Blob | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await processPhoto(await response.blob());
  } catch {
    // Offline oder Bild geloescht: der Eintrag entsteht trotzdem, nur ohne Foto.
    return null;
  }
}

/**
 * Baut den Record fuer einen Import. Bestehende Eintraege werden aktualisiert
 * und reaktiviert (Soft-Delete zurueckgenommen), nie dupliziert.
 */
function mergeEntry(
  input: CelebrityImportInput,
  existing: EntryRecord | undefined,
  photoBlobId: string | undefined,
  now: string,
): EntryRecord {
  if (existing) {
    return {
      ...existing,
      name: input.name.trim(),
      gender: input.gender,
      note: input.note?.trim() || existing.note,
      photoBlobId: photoBlobId ?? existing.photoBlobId,
      isCelebrity: true,
      tmdbId: input.tmdbId,
      deletedAt: null,
      updatedAt: now,
    };
  }
  return {
    id: newId(),
    name: input.name.trim(),
    photoBlobId,
    gender: input.gender,
    note: input.note?.trim() || undefined,
    isCelebrity: true,
    tmdbId: input.tmdbId,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function importCelebrity(
  input: CelebrityImportInput,
  options?: { listIds?: string[] },
): Promise<ImportResult> {
  const db = await getDB();
  const existing = await findEntryByTmdbId(input.tmdbId);

  // Nur laden, wenn wir noch kein Foto haben — ein erneuter Import soll nicht
  // jedes Mal Bytes ziehen.
  const wantsPhoto = Boolean(input.profileUrl) && !existing?.photoBlobId;
  const blob = wantsPhoto ? await downloadProfilePhoto(input.profileUrl as string) : null;

  const now = nowIso();
  const tx = db.transaction(['entries', 'photos', 'entryCategories', 'listEntries'], 'readwrite');

  let photoBlobId: string | undefined;
  if (blob) {
    photoBlobId = newId();
    void tx.objectStore('photos').put({ id: photoBlobId, blob, createdAt: now });
  }

  const entry = mergeEntry(input, existing, photoBlobId, now);
  void tx.objectStore('entries').put(entry);
  if (input.categoryId) {
    void tx.objectStore('entryCategories').put({ entryId: entry.id, categoryId: input.categoryId });
  }
  for (const listId of options?.listIds ?? []) {
    void tx.objectStore('listEntries').put({ listId, entryId: entry.id });
  }
  await tx.done;

  return { entry, created: !existing, photoFailed: wantsPhoto && !blob };
}

export interface BulkImportResult {
  entries: EntryRecord[];
  created: number;
  updated: number;
  photoFailures: number;
}

/**
 * "Ganzes Pack übernehmen": Bilder sequenziell (der Browser soll nicht 20
 * Downloads plus 20 Canvas-Encodings gleichzeitig stemmen), danach ein
 * einziger Schreibvorgang — eine halb importierte Liste gibt es damit nicht.
 */
export async function importCelebritiesBulk(
  inputs: CelebrityImportInput[],
  options?: { listIds?: string[]; onProgress?: (done: number, total: number) => void },
): Promise<BulkImportResult> {
  const db = await getDB();

  // Ein Lesevorgang statt N Index-Lookups.
  const allEntries = await db.getAll('entries');
  const byTmdbId = new Map<number, EntryRecord>();
  for (const entry of allEntries) {
    if (entry.tmdbId !== undefined) byTmdbId.set(entry.tmdbId, entry);
  }

  const prepared: Array<{ input: CelebrityImportInput; existing?: EntryRecord; blob: Blob | null }> =
    [];
  let photoFailures = 0;

  for (const [index, input] of inputs.entries()) {
    const existing = byTmdbId.get(input.tmdbId);
    const wantsPhoto = Boolean(input.profileUrl) && !existing?.photoBlobId;
    const blob = wantsPhoto ? await downloadProfilePhoto(input.profileUrl as string) : null;
    if (wantsPhoto && !blob) photoFailures += 1;
    prepared.push({ input, existing, blob });
    options?.onProgress?.(index + 1, inputs.length);
  }

  const now = nowIso();
  const tx = db.transaction(['entries', 'photos', 'entryCategories', 'listEntries'], 'readwrite');
  const entries: EntryRecord[] = [];
  let created = 0;

  for (const { input, existing, blob } of prepared) {
    let photoBlobId: string | undefined;
    if (blob) {
      photoBlobId = newId();
      void tx.objectStore('photos').put({ id: photoBlobId, blob, createdAt: now });
    }
    const entry = mergeEntry(input, existing, photoBlobId, now);
    void tx.objectStore('entries').put(entry);
    if (input.categoryId) {
      void tx
        .objectStore('entryCategories')
        .put({ entryId: entry.id, categoryId: input.categoryId });
    }
    for (const listId of options?.listIds ?? []) {
      void tx.objectStore('listEntries').put({ listId, entryId: entry.id });
    }
    entries.push(entry);
    if (!existing) created += 1;
  }
  await tx.done;

  return { entries, created, updated: entries.length - created, photoFailures };
}
