'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { listCategories } from '@/lib/db/categories';
import { createEntriesBulk, createEntry } from '@/lib/db/entries';
import { GENDERS, GENDER_LABELS, type CategoryRecord, type Gender } from '@/lib/db/schema';
import { EntryForm } from '@/components/entry/EntryForm';
import { CategoryTagPicker } from '@/components/lists/CategoryTagPicker';
import { Button } from '@/components/ui/Button';
import { Notice, PageHeader } from '@/components/ui/Feedback';

type Mode = 'single' | 'bulk';

export default function NewEntryPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('single');
  const [categories, setCategories] = useState<CategoryRecord[]>([]);

  useEffect(() => {
    listCategories()
      .then(setCategories)
      .catch((error) => console.error('Kategorien konnten nicht geladen werden', error));
  }, []);

  const addCategory = (category: CategoryRecord) => setCategories((prev) => [...prev, category]);

  return (
    <div>
      <PageHeader
        eyebrow="Neu"
        title="Anlegen"
        subtitle="Einzeln mit Foto oder mehrere Namen auf einmal."
      />

      <div className="mb-6 inline-flex rounded-xl border border-line p-1">
        {(['single', 'bulk'] as Mode[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
              mode === value ? 'bg-ink text-surface-0' : 'text-dim hover:text-ink'
            }`}
          >
            {value === 'single' ? 'Einzeln' : 'Mehrere'}
          </button>
        ))}
      </div>

      {mode === 'single' ? (
        <EntryForm
          categories={categories}
          submitLabel="Eintrag speichern"
          onCategoryCreated={addCategory}
          onSubmit={async (values) => {
            await createEntry({
              name: values.name,
              gender: values.gender,
              note: values.note,
              photoBlob: values.photoBlob,
              categoryIds: values.categoryIds,
            });
            router.push('/entries');
          }}
        />
      ) : (
        <BulkAddForm categories={categories} onCategoryCreated={addCategory} />
      )}
    </div>
  );
}

function BulkAddForm({
  categories,
  onCategoryCreated,
}: {
  categories: CategoryRecord[];
  onCategoryCreated: (category: CategoryRecord) => void;
}) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [gender, setGender] = useState<Gender>('unspecified');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Pro Zeile ein Name; Leerzeilen raus, Duplikate innerhalb der Eingabe zusammenfassen.
  const names = Array.from(
    new Map(
      text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((name) => [name.toLocaleLowerCase('de'), name]),
    ).values(),
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (names.length === 0 || saving) return;
    setSaving(true);
    try {
      await createEntriesBulk(names, { gender, categoryIds });
      router.push('/entries');
    } catch (error) {
      console.error('Bulk-Anlegen fehlgeschlagen', error);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="card space-y-4 p-4">
        <div>
          <label htmlFor="bulk-names" className="field-label">
            Namen — ein Name pro Zeile
          </label>
          <textarea
            id="bulk-names"
            className="input font-mono text-sm"
            rows={10}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={'Alex\nSam\nJordan'}
            autoFocus
          />
          <p className="muted mt-1">
            {names.length} {names.length === 1 ? 'Name' : 'Namen'} erkannt. Fotos kannst du später
            einzeln ergänzen.
          </p>
        </div>

        <div>
          <label htmlFor="bulk-gender" className="field-label">
            Gender für alle
          </label>
          <select
            id="bulk-gender"
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
      </div>

      <div className="card space-y-3 p-4">
        <span className="field-label">Kategorien für alle</span>
        <CategoryTagPicker
          categories={categories}
          selectedIds={categoryIds}
          onChange={setCategoryIds}
          onCategoryCreated={onCategoryCreated}
        />
      </div>

      {names.length > 40 ? (
        <Notice tone="info">
          {names.length} Einträge auf einmal — das kann einen Moment dauern.
        </Notice>
      ) : null}

      <Button type="submit" size="lg" disabled={names.length === 0 || saving}>
        {saving ? 'Legt an …' : `${names.length} Einträge anlegen`}
      </Button>
    </form>
  );
}
