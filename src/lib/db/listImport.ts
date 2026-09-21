import { CelebrityApiError, fetchCelebrity } from '@/lib/celebrities/api';
import { newId, nowIso } from '@/lib/ids';
import { processPhoto } from '@/lib/photo/resize';
import type { ListPayload } from '@/lib/share/listPayload';
import { getDB } from './client';
import { normalizeName, savePhoto } from './entries';
import type { CategoryRecord, EntryRecord } from './schema';

/**
 * Die Schreibseite des Teilens (FEATURES.md 5.5).
 *
 * Grundsatz: der Import darf nichts beschaedigen, was der Empfaenger gepflegt
 * hat. Namensgleiche Eintraege werden wiederverwendet statt dupliziert, Fotos
 * und Notizen des Empfaengers bleiben stehen, bestehende Listen werden nicht
 * angefasst.
 */

export interface PlannedEntry {
  name: string;
  /** Vorhandener Eintrag mit diesem Namen, sonst null. */
  existing: EntryRecord | null;
  tmdbId?: number;
}

export interface ImportPlan {
  listName: string;
  entries: PlannedEntry[];
  /** Wie viele Namen es beim Empfaenger schon gibt. */
  existingCount: number;
  celebrityCount: number;
}

/**
 * Reine Leseoperation fuer die Vorschau. Schreibt nichts — das ist die halbe
 * Zusage der Vorschau, und sie muss auch dann gelten, wenn die Seite
 * anschliessend verlassen wird.
 */
export async function planImport(payload: ListPayload): Promise<ImportPlan> {
  const db = await getDB();
  // Inklusive soft-geloeschter: sonst entsteht ein zweiter Eintrag mit dem
  // Namen einer Person, die nur im Papierkorb liegt.
  const all = await db.getAll('entries');
  const byName = new Map<string, EntryRecord>();
  for (const entry of all) {
    const key = normalizeName(entry.name);
    const known = byName.get(key);
    // Aktive schlagen geloeschte, sonst gewinnt der erste.
    if (!known || (known.deletedAt !== null && entry.deletedAt === null)) byName.set(key, entry);
  }

  const entries: PlannedEntry[] = payload.e.map((item) => ({
    name: item.n,
    existing: byName.get(normalizeName(item.n)) ?? null,
    ...(item.t !== undefined ? { tmdbId: item.t } : {}),
  }));

  return {
    listName: payload.n,
    entries,
    existingCount: entries.filter((entry) => entry.existing !== null).length,
    celebrityCount: entries.filter((entry) => entry.tmdbId !== undefined).length,
  };
}

/**
 * Was die TMDB-Abfrage ueber einen geteilten Promi ergeben hat.
 *
 * `rejected` heisst: die Route hat 404 geliefert. Das ist genau der Fall, in
 * dem die Alterssicherung greift (FEATURES.md 4.6) — die Route antwortet
 * bewusst mit 404, damit sich ueber die ID nichts daran vorbeiholen laesst.
 * Solche Eintraege duerfen gar nicht erst entstehen.
 *
 * `unavailable` heisst: kein Netz oder kein Schluessel. Dann entsteht der
 * Eintrag trotzdem, nur ohne Bild.
 */
export type CelebrityResolution =
  | { status: 'ok'; profileUrl: string | null }
  | { status: 'rejected' }
  | { status: 'unavailable' };

/**
 * Holt zu jeder TMDB-Kennung im Paket den aktuellen Stand. Laeuft VOR der
 * Transaktion, weil abgelehnte Personen sonst erst entstehen und danach wieder
 * entfernt werden muessten.
 *
 * Gebuendelt nebenlaeufig wie im Promi-Import, damit eine Liste mit zwanzig
 * Promis nicht zwanzig Runden dauert.
 */
export async function resolveCelebrities(
  payload: ListPayload,
  concurrency = 8,
): Promise<Map<number, CelebrityResolution>> {
  const ids = [...new Set(payload.e.map((item) => item.t).filter((t): t is number => t !== undefined))];
  const result = new Map<number, CelebrityResolution>();
  let cursor = 0;

  async function worker() {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= ids.length) return;
      const tmdbId = ids[index];
      try {
        const detail = await fetchCelebrity(tmdbId);
        result.set(tmdbId, { status: 'ok', profileUrl: detail.profileUrl ?? null });
      } catch (error) {
        const rejected = error instanceof CelebrityApiError && error.code === 'not_found';
        result.set(tmdbId, rejected ? { status: 'rejected' } : { status: 'unavailable' });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, worker));
  return result;
}

export interface ImportOutcome {
  listId: string;
  listName: string;
  /** Neu angelegte Eintraege. */
  created: number;
  /** Vorhandene Eintraege, die der Liste hinzugefuegt wurden. */
  reused: number;
  /** Soft-geloeschte, die dabei reaktiviert wurden (Teilmenge von reused). */
  restored: number;
  categoriesCreated: number;
  /** Von der Alterssicherung abgelehnt und deshalb nicht angelegt. */
  rejected: number;
  /** Promis, deren Stand nicht abrufbar war — entstanden, aber ohne Bild. */
  withoutPhoto: number;
  /** Eintraege, deren Bild nach der Transaktion geholt werden kann. */
  photoTargets: { entryId: string; profileUrl: string }[];
}

/**
 * Legt Liste, Kategorien, Eintraege und Mitgliedschaften an — in einer
 * Transaktion, damit kein halber Import zurueckbleibt.
 *
 * Bilder werden hier NICHT geholt: dafuer braucht es `fetch`, und eine
 * IndexedDB-Transaktion ueberlebt kein `await` auf das Netz. Der Aufrufer
 * erledigt das anschliessend ueber `attachPhotos()`.
 *
 * `resolution` kommt aus resolveCelebrities() und entscheidet, welche Promis
 * ueberhaupt entstehen duerfen.
 */
export async function applyImport(
  payload: ListPayload,
  resolution: Map<number, CelebrityResolution> = new Map(),
): Promise<ImportOutcome> {
  const db = await getDB();
  const now = nowIso();

  const existingEntries = await db.getAll('entries');
  const existingCategories = await db.getAll('categories');

  const entryByName = new Map<string, EntryRecord>();
  for (const entry of existingEntries) {
    const key = normalizeName(entry.name);
    const known = entryByName.get(key);
    if (!known || (known.deletedAt !== null && entry.deletedAt === null)) entryByName.set(key, entry);
  }

  const categoryById = new Map(existingCategories.map((c) => [c.id, c]));
  const categoryByName = new Map<string, CategoryRecord>();
  for (const category of existingCategories) categoryByName.set(normalizeName(category.name), category);

  const outcome: ImportOutcome = {
    listId: newId(),
    listName: payload.n,
    created: 0,
    reused: 0,
    restored: 0,
    categoriesCreated: 0,
    rejected: 0,
    withoutPhoto: 0,
    photoTargets: [],
  };

  /*
   * Kategorien zuerst aufloesen: Premade ueber die stabile ID (der Empfaenger
   * kann sie umbenannt haben, sie bleibt dieselbe), eigene ueber den Namen.
   */
  const newCategories: CategoryRecord[] = [];
  const categoryIdByIndex: string[] = payload.c.map((item) => {
    if (item.p && categoryById.has(item.p)) return item.p;
    const byName = categoryByName.get(normalizeName(item.n));
    if (byName) return byName.id;

    const category: CategoryRecord = {
      id: item.p ?? newId(),
      name: item.n,
      color: item.f,
      isPremade: Boolean(item.p),
      createdAt: now,
      updatedAt: now,
    };
    newCategories.push(category);
    categoryByName.set(normalizeName(category.name), category);
    categoryById.set(category.id, category);
    outcome.categoriesCreated += 1;
    return category.id;
  });

  const entriesToPut: EntryRecord[] = [];
  const memberIds: string[] = [];
  const categoryLinks: { entryId: string; categoryId: string }[] = [];

  for (const item of payload.e) {
    /*
     * Durchgefallene Promis entstehen gar nicht erst. Die Alterssicherung
     * (FEATURES.md 4.6) ist nicht verhandelbar, und ein geteilter Link darf
     * kein Weg daran vorbei sein.
     */
    if (item.t !== undefined && resolution.get(item.t)?.status === 'rejected') {
      outcome.rejected += 1;
      continue;
    }

    const existing = entryByName.get(normalizeName(item.n));
    let entryId: string;

    if (existing) {
      entryId = existing.id;
      outcome.reused += 1;
      if (existing.deletedAt !== null) {
        // Reaktivieren statt danebenlegen — dasselbe tut importCelebrity().
        entriesToPut.push({ ...existing, deletedAt: null, updatedAt: now });
        outcome.restored += 1;
      }
      // Foto, Notiz und Geschlecht des Empfaengers bleiben unberuehrt: was er
      // gepflegt hat, weiss er besser als der Link.
    } else {
      entryId = newId();
      entriesToPut.push({
        id: entryId,
        name: item.n,
        gender: item.g,
        note: item.o,
        isCelebrity: item.t !== undefined,
        ...(item.t !== undefined ? { tmdbId: item.t } : {}),
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      outcome.created += 1;
    }

    memberIds.push(entryId);
    for (const index of item.c ?? []) {
      const categoryId = categoryIdByIndex[index];
      if (categoryId) categoryLinks.push({ entryId, categoryId });
    }

    if (item.t !== undefined) {
      const resolved = resolution.get(item.t);
      if (resolved?.status === 'ok' && resolved.profileUrl) {
        outcome.photoTargets.push({ entryId, profileUrl: resolved.profileUrl });
      } else {
        outcome.withoutPhoto += 1;
      }
    }
  }

  const tx = db.transaction(
    ['lists', 'listEntries', 'entries', 'categories', 'entryCategories'],
    'readwrite',
  );
  // Immer eine neue Liste. Eine bestehende gleichen Namens bleibt, wie sie ist.
  void tx.objectStore('lists').put({
    id: outcome.listId,
    name: payload.n,
    createdAt: now,
    updatedAt: now,
  });
  for (const category of newCategories) void tx.objectStore('categories').put(category);
  for (const entry of entriesToPut) void tx.objectStore('entries').put(entry);
  for (const entryId of memberIds) {
    void tx.objectStore('listEntries').put({ listId: outcome.listId, entryId });
  }
  for (const link of categoryLinks) void tx.objectStore('entryCategories').put(link);
  await tx.done;

  return outcome;
}

/**
 * Holt die Promi-Bilder und haengt sie an die bereits angelegten Eintraege.
 *
 * Bewusst nicht ueber importCelebrity(): das dedupliziert ueber `tmdbId` und
 * wuerde einen zweiten Eintrag anlegen, wenn der Import zuvor ueber den Namen
 * auf einen vorhandenen Eintrag ohne TMDB-Kennung zusammengefuehrt hat. Die
 * Bilder gehoeren an genau die Eintraege, die in der neuen Liste stehen.
 *
 * Gibt zurueck, wie viele Bilder nicht durchkamen. Ein fehlendes Bild ist kein
 * Grund, den Import scheitern zu lassen — es bleibt beim Initialen-Avatar.
 */
export async function attachPhotos(
  targets: { entryId: string; profileUrl: string }[],
  concurrency = 4,
): Promise<number> {
  if (targets.length === 0) return 0;
  const db = await getDB();
  let failed = 0;
  let cursor = 0;

  async function worker() {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= targets.length) return;
      const target = targets[index];
      try {
        const response = await fetch(target.profileUrl);
        if (!response.ok) throw new Error(String(response.status));
        // Dieselbe Pipeline wie bei eigenen Fotos und beim Promi-Import.
        const blob = await processPhoto(await response.blob());
        const photoBlobId = await savePhoto(blob);
        const entry = await db.get('entries', target.entryId);
        if (!entry) continue;
        await db.put('entries', { ...entry, photoBlobId, updatedAt: nowIso() });
      } catch {
        failed += 1;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, worker));
  return failed;
}
