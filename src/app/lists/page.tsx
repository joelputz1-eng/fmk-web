'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  CATEGORY_COLORS,
  countEntriesPerCategory,
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from '@/lib/db/categories';
import { countEntriesPerList, createList, deleteList, listLists, renameList } from '@/lib/db/lists';
import type { CategoryRecord, ListRecord } from '@/lib/db/schema';
import { Button } from '@/components/ui/Button';
import { EmptyState, Loading, PageHeader } from '@/components/ui/Feedback';

export default function ListsPage() {
  const [lists, setLists] = useState<ListRecord[]>([]);
  const [listCounts, setListCounts] = useState<Map<string, number>>(new Map());
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [newListName, setNewListName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState<string>(CATEGORY_COLORS[0]);

  const reload = async () => {
    const [loadedLists, loadedListCounts, loadedCategories, loadedCategoryCounts] =
      await Promise.all([
        listLists(),
        countEntriesPerList(),
        listCategories(),
        countEntriesPerCategory(),
      ]);
    setLists(loadedLists);
    setListCounts(loadedListCounts);
    setCategories(loadedCategories);
    setCategoryCounts(loadedCategoryCounts);
    setLoading(false);
  };

  useEffect(() => {
    reload().catch((error) => {
      console.error('Listen konnten nicht geladen werden', error);
      setLoading(false);
    });
  }, []);

  const handleCreateList = async () => {
    const name = newListName.trim();
    if (!name) return;
    await createList(name);
    setNewListName('');
    await reload();
  };

  const handleRenameList = async (list: ListRecord) => {
    const name = prompt('Liste umbenennen', list.name);
    if (!name?.trim()) return;
    await renameList(list.id, name);
    await reload();
  };

  const handleDeleteList = async (list: ListRecord) => {
    if (!confirm(`Liste "${list.name}" löschen? Die Einträge selbst bleiben erhalten.`)) return;
    await deleteList(list.id);
    await reload();
  };

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    await createCategory(name, newCategoryColor);
    setNewCategoryName('');
    await reload();
  };

  const handleRenameCategory = async (category: CategoryRecord) => {
    const name = prompt('Kategorie umbenennen', category.name);
    if (!name?.trim()) return;
    await updateCategory(category.id, { name });
    await reload();
  };

  const handleDeleteCategory = async (category: CategoryRecord) => {
    const count = categoryCounts.get(category.id) ?? 0;
    const suffix = count > 0 ? ` Sie ist ${count} Einträgen zugeordnet.` : '';
    if (!confirm(`Kategorie "${category.name}" löschen?${suffix} Die Einträge bleiben erhalten.`)) {
      return;
    }
    await deleteCategory(category.id);
    await reload();
  };

  if (loading) return <Loading label="Lade Listen …" />;

  return (
    <div className="space-y-10">
      <section>
        <PageHeader
          eyebrow="Sammlungen"
          title="Listen"
          subtitle="Ein Eintrag kann in mehreren Listen sein."
        />

        <div className="card mb-4 flex gap-2 p-3">
          <input
            className="input flex-1"
            placeholder="Neue Liste, z.B. „Uni-Freunde“"
            value={newListName}
            onChange={(event) => setNewListName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void handleCreateList();
              }
            }}
          />
          <Button disabled={!newListName.trim()} onClick={() => void handleCreateList()}>
            Erstellen
          </Button>
        </div>

        {lists.length === 0 ? (
          <EmptyState
            title="Noch keine Listen"
            description="Listen gruppieren Einträge — z.B. „Arbeit“ oder „Uni“. Ohne Liste kannst du trotzdem mit allen Einträgen spielen."
          />
        ) : (
          <ul className="space-y-2">
            {lists.map((list) => (
              <li key={list.id} className="card flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{list.name}</div>
                  <div className="muted">{listCounts.get(list.id) ?? 0} Einträge</div>
                </div>
                <Link
                  href={`/lists/${list.id}`}
                  className="rounded-xl bg-ink px-4 py-1.5 text-sm font-semibold text-surface-0 transition hover:opacity-85"
                >
                  Öffnen
                </Link>
                <Button variant="ghost" size="sm" onClick={() => void handleRenameList(list)}>
                  Umbenennen
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void handleDeleteList(list)}>
                  Löschen
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <PageHeader
          eyebrow="Tags"
          title="Kategorien"
          subtitle="Farbcodiert, quer über alle Einträge und Listen."
        />

        <div className="card mb-4 space-y-3 p-3">
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Neue Kategorie"
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleCreateCategory();
                }
              }}
            />
            <Button disabled={!newCategoryName.trim()} onClick={() => void handleCreateCategory()}>
              Erstellen
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Farbe ${color}`}
                onClick={() => setNewCategoryColor(color)}
                className={`h-7 w-7 rounded-full transition-transform ${
                  newCategoryColor === color
                    ? 'scale-110 ring-2 ring-ink ring-offset-2 ring-offset-surface-1'
                    : ''
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        <ul className="space-y-2">
          {categories.map((category) => (
            <li key={category.id} className="card flex items-center gap-3 p-3">
              <span
                className="h-4 w-4 shrink-0 rounded-full"
                style={{ backgroundColor: category.color }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{category.name}</span>
                  {category.isPremade ? (
                    <span className="chip border border-line text-dim">
                      vorgefertigt
                    </span>
                  ) : null}
                </div>
                <div className="muted">{categoryCounts.get(category.id) ?? 0} Einträge</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => void handleRenameCategory(category)}>
                Umbenennen
              </Button>
              <Button variant="ghost" size="sm" onClick={() => void handleDeleteCategory(category)}>
                Löschen
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
