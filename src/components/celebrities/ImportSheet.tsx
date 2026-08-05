'use client';

import { useEffect, useState } from 'react';
import type { CategoryRecord, ListRecord } from '@/lib/db/schema';
import { CategoryTagPicker } from '@/components/lists/CategoryTagPicker';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Feedback';

/**
 * Zielliste(n) und Kategorien waehlen, bevor uebernommen wird. Beides ist
 * optional — der Eintrag liegt dann nur im Gesamtbestand, was zum Spielen
 * reicht und ihn ueber den "Promi"-Chip auffindbar laesst.
 */
export function ImportSheet({
  title,
  subtitle,
  lists,
  defaultListIds,
  categories,
  allowCategories,
  suggestedCategoryId,
  suggestionPending,
  busy,
  progress,
  error,
  onCreateList,
  onCategoryCreated,
  onCancel,
  onConfirm,
}: {
  title: string;
  subtitle: string;
  lists: ListRecord[];
  defaultListIds: string[];
  categories: CategoryRecord[];
  /** false beim Pack-Import — dort gibt es bewusst keine Kategorien. */
  allowCategories: boolean;
  /** Wikidata-Vorschlag, falls ermittelbar. Vorbelegung, keine Vorschrift. */
  suggestedCategoryId: string | null;
  /** true, solange der Vorschlag noch geladen wird. */
  suggestionPending: boolean;
  busy: boolean;
  /** Fortschritt beim Pack-Import, sonst null. */
  progress: { done: number; total: number } | null;
  error: string | null;
  onCreateList: (name: string) => Promise<ListRecord>;
  onCategoryCreated: (category: CategoryRecord) => void;
  onCancel: () => void;
  onConfirm: (listIds: string[], categoryIds: string[]) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(defaultListIds);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [categoriesTouched, setCategoriesTouched] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [creating, setCreating] = useState(false);

  /**
   * Der Dialog geht sofort auf, der Vorschlag trudelt nach. Uebernommen wird er
   * nur, solange niemand selbst an der Auswahl war — sonst wuerde er eine
   * bewusste Entscheidung ueberschreiben.
   */
  useEffect(() => {
    if (!categoriesTouched && suggestedCategoryId) setCategoryIds([suggestedCategoryId]);
  }, [suggestedCategoryId, categoriesTouched]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, onCancel]);

  const toggle = (listId: string) => {
    setSelectedIds((current) =>
      current.includes(listId) ? current.filter((id) => id !== listId) : [...current, listId],
    );
  };

  const handleCreate = async () => {
    const name = newListName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const list = await onCreateList(name);
      setNewListName('');
      setSelectedIds((current) => [...current, list.id]);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="card max-h-[85vh] w-full max-w-md overflow-y-auto rounded-b-none p-5 sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="eyebrow mb-2">Übernehmen</p>
        <h2 className="display text-2xl">{title}</h2>
        <p className="muted mt-1">{subtitle}</p>
        <div className="spine mt-4 rounded-full" />

        <div className="mt-4">
          <span className="field-label">Zielliste(n)</span>
          {lists.length === 0 ? (
            <p className="muted">Noch keine Liste vorhanden — leg unten eine an.</p>
          ) : (
            <ul className="space-y-1">
              {lists.map((list) => (
                <li key={list.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2">
                    <input
                      type="checkbox"
                      className="h-5 w-5 rounded border-line bg-surface-1 text-marry focus:ring-marry"
                      checked={selectedIds.includes(list.id)}
                      disabled={busy}
                      onChange={() => toggle(list.id)}
                    />
                    <span className="truncate">{list.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            className="input flex-1"
            placeholder="Neue Liste anlegen …"
            value={newListName}
            disabled={busy}
            onChange={(event) => setNewListName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void handleCreate();
              }
            }}
          />
          <Button
            variant="secondary"
            disabled={!newListName.trim() || creating || busy}
            onClick={() => void handleCreate()}
          >
            Anlegen
          </Button>
        </div>

        {selectedIds.length === 0 ? (
          <p className="muted mt-3">
            Ohne Auswahl landet die Person nur im Gesamtbestand — spielbar ist sie trotzdem.
          </p>
        ) : null}

        {allowCategories ? (
          <div className="mt-5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="field-label">Kategorie</span>
              {suggestionPending ? (
                <span className="eyebrow">Suche Beruf …</span>
              ) : suggestedCategoryId ? (
                /* Kennzeichnen, damit klar ist: das kommt nicht vom Nutzer. */
                <span className="eyebrow">vorgeschlagen</span>
              ) : null}
            </div>
            <CategoryTagPicker
              categories={categories}
              selectedIds={categoryIds}
              onChange={(ids) => {
                setCategoriesTouched(true);
                setCategoryIds(ids);
              }}
              onCategoryCreated={onCategoryCreated}
            />
            {categoryIds.length === 0 ? (
              <p className="muted mt-2">
                Ohne Kategorie ist die Person über den „Promi“-Chip in den Einträgen auffindbar.
              </p>
            ) : null}
          </div>
        ) : null}

        {progress ? (
          <p className="eyebrow mt-4">
            Lade Bilder … {progress.done} / {progress.total}
          </p>
        ) : null}

        {error ? (
          <div className="mt-4">
            <Notice tone="error">{error}</Notice>
          </div>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" disabled={busy} onClick={onCancel}>
            Abbrechen
          </Button>
          <Button disabled={busy} onClick={() => onConfirm(selectedIds, categoryIds)}>
            {busy ? 'Übernimmt …' : 'Übernehmen'}
          </Button>
        </div>
      </div>
    </div>
  );
}
