'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { listCategories } from '@/lib/db/categories';
import {
  getCategoryIdsForEntry,
  getEntry,
  softDeleteEntry,
  updateEntry,
} from '@/lib/db/entries';
import { usePhotoBlob } from '@/lib/hooks/useObjectUrl';
import type { CategoryRecord, EntryRecord } from '@/lib/db/schema';
import { EntryForm } from '@/components/entry/EntryForm';
import { Button } from '@/components/ui/Button';
import { EmptyState, Loading, PageHeader } from '@/components/ui/Feedback';

export default function EditEntryPage() {
  // In Next 15 ist die params-Prop ein Promise — in Client-Komponenten
  // deshalb immer ueber useParams() lesen.
  const params = useParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : params.id?.[0];
  const router = useRouter();

  const [entry, setEntry] = useState<EntryRecord | null>(null);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const existingPhoto = usePhotoBlob(entry?.photoBlobId);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    Promise.all([getEntry(id), listCategories(), getCategoryIdsForEntry(id)])
      .then(([loadedEntry, loadedCategories, loadedCategoryIds]) => {
        if (cancelled) return;
        setEntry(loadedEntry ?? null);
        setCategories(loadedCategories);
        setCategoryIds(loadedCategoryIds);
      })
      .catch((error) => console.error('Eintrag konnte nicht geladen werden', error))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <Loading label="Lade Eintrag …" />;
  if (!entry) {
    return (
      <EmptyState
        title="Eintrag nicht gefunden"
        description="Er wurde vermutlich gelöscht."
        actionHref="/entries"
        actionLabel="Zurück zu den Einträgen"
      />
    );
  }

  const handleDelete = async () => {
    if (!confirm(`"${entry.name}" löschen? Die Rundenhistorie bleibt erhalten.`)) return;
    await softDeleteEntry(entry.id);
    router.push('/entries');
  };

  return (
    <div>
      <PageHeader eyebrow="Bearbeiten" title={entry.name} />
      <EntryForm
        // Remount, sobald der Eintrag steht — sonst greifen die Initialwerte nicht.
        key={entry.id}
        categories={categories}
        excludeIdFromDuplicateCheck={entry.id}
        initial={{
          name: entry.name,
          gender: entry.gender,
          note: entry.note ?? '',
          categoryIds,
          photoBlob: existingPhoto,
        }}
        submitLabel="Änderungen speichern"
        onCategoryCreated={(category) => setCategories((prev) => [...prev, category])}
        onSubmit={async (values) => {
          await updateEntry(entry.id, {
            name: values.name,
            gender: values.gender,
            note: values.note,
            // undefined = Foto unveraendert lassen.
            photoBlob: values.photoDirty ? values.photoBlob : undefined,
            categoryIds: values.categoryIds,
          });
          router.push('/entries');
        }}
        extraActions={
          <Button variant="danger" onClick={() => void handleDelete()}>
            Löschen
          </Button>
        }
      />
    </div>
  );
}
