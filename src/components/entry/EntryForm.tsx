'use client';

import { useEffect, useState } from 'react';
import { findDuplicateNames } from '@/lib/db/entries';
import { GENDERS, GENDER_LABELS, type CategoryRecord, type Gender } from '@/lib/db/schema';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Feedback';
import { CategoryTagPicker } from '@/components/lists/CategoryTagPicker';
import { PhotoPicker } from './PhotoPicker';

export interface EntryFormValues {
  name: string;
  gender: Gender;
  note: string;
  categoryIds: string[];
  photoBlob: Blob | null;
  /** true = Foto wurde in diesem Formular geaendert (auch: entfernt). */
  photoDirty: boolean;
}

export function EntryForm({
  categories,
  initial,
  submitLabel,
  excludeIdFromDuplicateCheck,
  onSubmit,
  onCategoryCreated,
  extraActions,
}: {
  categories: CategoryRecord[];
  initial?: Partial<Omit<EntryFormValues, 'photoDirty'>>;
  submitLabel: string;
  excludeIdFromDuplicateCheck?: string;
  onSubmit: (values: EntryFormValues) => Promise<void>;
  onCategoryCreated?: (category: CategoryRecord) => void;
  extraActions?: React.ReactNode;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [gender, setGender] = useState<Gender>(initial?.gender ?? 'unspecified');
  const [note, setNote] = useState(initial?.note ?? '');
  const [categoryIds, setCategoryIds] = useState<string[]>(initial?.categoryIds ?? []);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(initial?.photoBlob ?? null);
  const [photoDirty, setPhotoDirty] = useState(false);
  const [duplicates, setDuplicates] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bestehendes Foto kommt asynchron nach — nur uebernehmen, solange der
  // Nutzer selbst noch nichts geaendert hat.
  useEffect(() => {
    if (!photoDirty && initial?.photoBlob) setPhotoBlob(initial.photoBlob);
  }, [initial?.photoBlob, photoDirty]);

  // Duplikat-Warnung (2.7), entspannt per Debounce.
  useEffect(() => {
    const trimmed = name.trim();
    if (!trimmed) {
      setDuplicates([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      findDuplicateNames(trimmed, { excludeId: excludeIdFromDuplicateCheck })
        .then((found) => {
          if (!cancelled) setDuplicates(found.map((entry) => entry.name));
        })
        .catch(() => {
          if (!cancelled) setDuplicates([]);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [name, excludeIdFromDuplicateCheck]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ name, gender, note, categoryIds, photoBlob, photoDirty });
    } catch (cause) {
      console.error(cause);
      setError('Speichern fehlgeschlagen.');
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="card space-y-4 p-4">
        <div>
          <label htmlFor="entry-name" className="field-label">
            Name <span className="text-fuck">*</span>
          </label>
          <input
            id="entry-name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="z.B. Alex"
            required
            autoFocus
          />
        </div>

        {duplicates.length > 0 ? (
          <Notice tone="warning">
            Es gibt bereits {duplicates.length === 1 ? 'einen Eintrag' : `${duplicates.length} Einträge`} mit
            diesem Namen. Doppelt anlegen geht trotzdem.
          </Notice>
        ) : null}

        <div>
          <span className="field-label">Foto</span>
          <PhotoPicker
            name={name}
            value={photoBlob}
            onChange={(blob) => {
              setPhotoBlob(blob);
              setPhotoDirty(true);
            }}
          />
        </div>

        <div>
          <label htmlFor="entry-gender" className="field-label">
            Gender
          </label>
          <select
            id="entry-gender"
            className="input"
            value={gender}
            onChange={(event) => setGender(event.target.value as Gender)}
          >
            {GENDERS.map((value) => (
              <option key={value} value={value}>
                {GENDER_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="entry-note" className="field-label">
            Notiz
          </label>
          <textarea
            id="entry-note"
            className="input"
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional"
          />
        </div>
      </div>

      <div className="card space-y-3 p-4">
        <span className="field-label">Kategorien</span>
        <CategoryTagPicker
          categories={categories}
          selectedIds={categoryIds}
          onChange={setCategoryIds}
          onCategoryCreated={onCategoryCreated}
        />
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={!name.trim() || saving}>
          {saving ? 'Speichert …' : submitLabel}
        </Button>
        {extraActions}
      </div>
    </form>
  );
}
