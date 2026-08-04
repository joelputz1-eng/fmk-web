'use client';

import { useEffect, useState } from 'react';
import type { ListRecord } from '@/lib/db/schema';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Feedback';

/**
 * Zielliste(n) waehlen, bevor uebernommen wird. Keine Auswahl ist erlaubt —
 * der Eintrag liegt dann nur im Gesamtbestand, was zum Spielen reicht.
 */
export function ImportSheet({
  title,
  subtitle,
  lists,
  defaultListIds,
  busy,
  progress,
  error,
  onCreateList,
  onCancel,
  onConfirm,
}: {
  title: string;
  subtitle: string;
  lists: ListRecord[];
  defaultListIds: string[];
  busy: boolean;
  /** Fortschritt beim Pack-Import, sonst null. */
  progress: { done: number; total: number } | null;
  error: string | null;
  onCreateList: (name: string) => Promise<ListRecord>;
  onCancel: () => void;
  onConfirm: (listIds: string[]) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(defaultListIds);
  const [newListName, setNewListName] = useState('');
  const [creating, setCreating] = useState(false);

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
          <Button disabled={busy} onClick={() => onConfirm(selectedIds)}>
            {busy ? 'Übernimmt …' : 'Übernehmen'}
          </Button>
        </div>
      </div>
    </div>
  );
}
