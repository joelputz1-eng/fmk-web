import { newId, nowIso } from '@/lib/ids';
import { getDB } from './client';
import type { ListRecord } from './schema';

export async function listLists(): Promise<ListRecord[]> {
  const db = await getDB();
  const all = await db.getAll('lists');
  return all.sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

export async function getList(id: string): Promise<ListRecord | undefined> {
  const db = await getDB();
  return db.get('lists', id);
}

export async function createList(name: string): Promise<ListRecord> {
  const db = await getDB();
  const now = nowIso();
  const list: ListRecord = { id: newId(), name: name.trim(), createdAt: now, updatedAt: now };
  await db.put('lists', list);
  return list;
}

export async function renameList(id: string, name: string): Promise<void> {
  const db = await getDB();
  const current = await db.get('lists', id);
  if (!current) return;
  await db.put('lists', { ...current, name: name.trim(), updatedAt: nowIso() });
}

/** Loescht die Liste und ihre Mitgliedschaften. Entries selbst bleiben erhalten. */
export async function deleteList(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['lists', 'listEntries'], 'readwrite');
  void tx.objectStore('lists').delete(id);
  const memberStore = tx.objectStore('listEntries');
  const members = await memberStore.index('by-list').getAll(id);
  for (const member of members) {
    void memberStore.delete([member.listId, member.entryId]);
  }
  await tx.done;
}

export async function getListEntryIds(listId: string): Promise<string[]> {
  const db = await getDB();
  const members = await db.getAllFromIndex('listEntries', 'by-list', listId);
  return members.map((member) => member.entryId);
}

export async function setListMembership(
  listId: string,
  entryId: string,
  member: boolean,
): Promise<void> {
  const db = await getDB();
  if (member) await db.put('listEntries', { listId, entryId });
  else await db.delete('listEntries', [listId, entryId]);
}

export async function countEntriesPerList(): Promise<Map<string, number>> {
  const db = await getDB();
  const members = await db.getAll('listEntries');
  const counts = new Map<string, number>();
  for (const member of members) {
    counts.set(member.listId, (counts.get(member.listId) ?? 0) + 1);
  }
  return counts;
}
