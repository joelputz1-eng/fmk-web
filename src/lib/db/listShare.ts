import {
  PAYLOAD_VERSION,
  type ListPayload,
  type PayloadCategory,
  type PayloadEntry,
} from '@/lib/share/listPayload';
import { getCategoryIdsByEntry, getEntriesByIds } from './entries';
import { listCategories } from './categories';
import { getList, getListEntryIds } from './lists';

/**
 * Die Leseseite des Teilens (FEATURES.md 5.5): eine Liste aus IndexedDB in das
 * Linkformat ueberfuehren.
 *
 * Das Format selbst und seine Grenzen stehen in src/lib/share/listPayload.ts —
 * hier wird nur gelesen und umgeschichtet.
 */

/** null = die Liste gibt es nicht (mehr). */
export async function buildPayloadForList(listId: string): Promise<ListPayload | null> {
  const list = await getList(listId);
  if (!list) return null;

  const memberIds = await getListEntryIds(listId);
  const entriesById = await getEntriesByIds(memberIds);
  const [categories, categoryIdsByEntry] = await Promise.all([
    listCategories(),
    getCategoryIdsByEntry(),
  ]);
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  /*
   * Nur Kategorien, die auch benutzt werden, wandern in den Link. Jede
   * ungenutzte Zeile kostet Bytes, die sich in der Linklaenge niederschlagen.
   * Der Index in dieser Liste ist es, worauf die Eintraege verweisen.
   */
  const payloadCategories: PayloadCategory[] = [];
  const indexByCategoryId = new Map<string, number>();

  const addCategory = (categoryId: string): number | null => {
    const known = indexByCategoryId.get(categoryId);
    if (known !== undefined) return known;
    const category = categoryById.get(categoryId);
    if (!category) return null;
    const index = payloadCategories.length;
    payloadCategories.push({
      n: category.name,
      f: category.color,
      // Premade-Kategorien tragen stabile IDs und treffen sich beim Empfaenger
      // dadurch von selbst, auch wenn er sie umbenannt hat.
      ...(category.isPremade ? { p: category.id } : {}),
    });
    indexByCategoryId.set(categoryId, index);
    return index;
  };

  const entries: PayloadEntry[] = [];
  // Reihenfolge wie in der Liste, nicht wie in der Map — sonst sieht der
  // Empfaenger eine andere Sortierung als der Absender.
  for (const entryId of memberIds) {
    const entry = entriesById.get(entryId);
    if (!entry) continue;
    // Geteilt wird, was der Absender aktuell sieht.
    if (entry.deletedAt !== null) continue;

    const indexes: number[] = [];
    for (const categoryId of categoryIdsByEntry.get(entry.id) ?? []) {
      const index = addCategory(categoryId);
      if (index !== null) indexes.push(index);
    }

    entries.push({
      n: entry.name,
      g: entry.gender,
      ...(entry.note ? { o: entry.note } : {}),
      // Fotos reisen nicht mit — ein einziges Bild sprengt jede URL. Bei Promis
      // genuegt die Kennung, der Empfaenger laedt das Bild selbst nach.
      ...(entry.tmdbId !== undefined ? { t: entry.tmdbId } : {}),
      ...(indexes.length > 0 ? { c: indexes } : {}),
    });
  }

  return { v: PAYLOAD_VERSION, n: list.name, c: payloadCategories, e: entries };
}
