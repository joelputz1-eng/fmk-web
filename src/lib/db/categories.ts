import { newId, nowIso } from '@/lib/ids';
import { getDB } from './client';
import type { CategoryRecord } from './schema';

/** Farbvorschlaege fuer neue, nutzerangelegte Kategorien (3.2). */
export const CATEGORY_COLORS = [
  '#e11d48',
  '#f97316',
  '#f59e0b',
  '#10b981',
  '#0ea5e9',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
] as const;

export async function listCategories(): Promise<CategoryRecord[]> {
  const db = await getDB();
  const all = await db.getAll('categories');
  return all.sort((a, b) => {
    if (a.isPremade !== b.isPremade) return a.isPremade ? -1 : 1;
    return a.name.localeCompare(b.name, 'de');
  });
}

export async function createCategory(name: string, color: string): Promise<CategoryRecord> {
  const db = await getDB();
  const now = nowIso();
  const category: CategoryRecord = {
    id: newId(),
    name: name.trim(),
    color,
    isPremade: false,
    createdAt: now,
    updatedAt: now,
  };
  await db.put('categories', category);
  return category;
}

export async function updateCategory(
  id: string,
  patch: { name?: string; color?: string },
): Promise<void> {
  const db = await getDB();
  const current = await db.get('categories', id);
  if (!current) return;
  await db.put('categories', {
    ...current,
    name: patch.name?.trim() ?? current.name,
    color: patch.color ?? current.color,
    updatedAt: nowIso(),
  });
}

/** Loescht die Kategorie und alle Zuordnungen. Entries bleiben bestehen. */
export async function deleteCategory(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['categories', 'entryCategories'], 'readwrite');
  void tx.objectStore('categories').delete(id);
  const linkStore = tx.objectStore('entryCategories');
  const links = await linkStore.index('by-category').getAll(id);
  for (const link of links) {
    void linkStore.delete([link.entryId, link.categoryId]);
  }
  await tx.done;
}

export async function getEntryIdsForCategories(categoryIds: string[]): Promise<Set<string>> {
  const db = await getDB();
  const result = new Set<string>();
  for (const categoryId of categoryIds) {
    const links = await db.getAllFromIndex('entryCategories', 'by-category', categoryId);
    for (const link of links) result.add(link.entryId);
  }
  return result;
}

export async function countEntriesPerCategory(): Promise<Map<string, number>> {
  const db = await getDB();
  const links = await db.getAll('entryCategories');
  const counts = new Map<string, number>();
  for (const link of links) {
    counts.set(link.categoryId, (counts.get(link.categoryId) ?? 0) + 1);
  }
  return counts;
}
