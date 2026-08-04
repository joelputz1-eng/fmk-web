'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { listCategories } from '@/lib/db/categories';
import { getCategoryIdsByEntry, listEntries, restoreEntry, softDeleteEntry } from '@/lib/db/entries';
import { getEntryPlayStats, type EntryPlayStats } from '@/lib/db/rounds';
import {
  GENDER_FILTER_LABELS,
  type CategoryRecord,
  type EntryRecord,
  type GenderFilter,
} from '@/lib/db/schema';
import {
  ENTRY_ORIGIN_LABELS,
  ENTRY_ORIGINS,
  type EntryOrigin,
} from '@/lib/game/poolBuilder';
import { EntryAvatar } from '@/components/entry/EntryAvatar';
import { Button } from '@/components/ui/Button';
import { EmptyState, Loading, PageHeader } from '@/components/ui/Feedback';

type SortMode = 'name' | 'recent' | 'played';

const SORT_LABELS: Record<SortMode, string> = {
  name: 'Name (A–Z)',
  recent: 'Zuletzt hinzugefügt',
  played: 'Meist gespielt',
};

export default function EntriesPage() {
  const [entries, setEntries] = useState<EntryRecord[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [categoryIdsByEntry, setCategoryIdsByEntry] = useState<Map<string, string[]>>(new Map());
  const [stats, setStats] = useState<Map<string, EntryPlayStats>>(new Map());
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('name');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all');
  const [originFilter, setOriginFilter] = useState<EntryOrigin>('all');
  const [showDeleted, setShowDeleted] = useState(false);

  const reload = async () => {
    const [loadedEntries, loadedCategories, links, playStats] = await Promise.all([
      listEntries({ includeDeleted: true }),
      listCategories(),
      getCategoryIdsByEntry(),
      getEntryPlayStats(),
    ]);
    setEntries(loadedEntries);
    setCategories(loadedCategories);
    setCategoryIdsByEntry(links);
    setStats(playStats);
    setLoading(false);
  };

  useEffect(() => {
    reload().catch((error) => {
      console.error('Einträge konnten nicht geladen werden', error);
      setLoading(false);
    });
  }, []);

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const visible = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('de');
    const filtered = entries.filter((entry) => {
      if (showDeleted ? entry.deletedAt === null : entry.deletedAt !== null) return false;
      if (needle && !entry.name.toLocaleLowerCase('de').includes(needle)) return false;
      if (genderFilter !== 'all' && entry.gender !== genderFilter) return false;
      if (originFilter === 'own' && entry.isCelebrity) return false;
      if (originFilter === 'celebrity' && !entry.isCelebrity) return false;
      if (categoryFilter !== 'all') {
        const ids = categoryIdsByEntry.get(entry.id) ?? [];
        if (!ids.includes(categoryFilter)) return false;
      }
      return true;
    });

    return filtered.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name, 'de');
      if (sort === 'recent') return b.createdAt.localeCompare(a.createdAt);
      return (stats.get(b.id)?.shown ?? 0) - (stats.get(a.id)?.shown ?? 0);
    });
  }, [
    entries,
    search,
    sort,
    categoryFilter,
    genderFilter,
    originFilter,
    showDeleted,
    categoryIdsByEntry,
    stats,
  ]);

  const activeCount = entries.filter((entry) => entry.deletedAt === null).length;
  const deletedCount = entries.length - activeCount;

  const handleDelete = async (entry: EntryRecord) => {
    if (!confirm(`"${entry.name}" löschen? Die Rundenhistorie bleibt erhalten.`)) return;
    await softDeleteEntry(entry.id);
    await reload();
  };

  const handleRestore = async (entry: EntryRecord) => {
    await restoreEntry(entry.id);
    await reload();
  };

  if (loading) return <Loading label="Lade Einträge …" />;

  return (
    <div>
      <PageHeader
        eyebrow="Bestand"
        title="Einträge"
        subtitle={`${activeCount} aktiv${deletedCount > 0 ? `, ${deletedCount} gelöscht` : ''}`}
        action={
          <Link
            href="/entries/new"
            className="inline-flex items-center rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-surface-0 transition hover:opacity-85"
          >
            Neu
          </Link>
        }
      />

      <div className="card mb-4 space-y-3 p-3">
        <input
          className="input"
          type="search"
          placeholder="Suchen …"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <select
            className="input"
            value={sort}
            onChange={(event) => setSort(event.target.value as SortMode)}
            aria-label="Sortierung"
          >
            {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
              <option key={mode} value={mode}>
                {SORT_LABELS[mode]}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            aria-label="Kategorie-Filter"
          >
            <option value="all">Alle Kategorien</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={genderFilter}
            onChange={(event) => setGenderFilter(event.target.value as GenderFilter)}
            aria-label="Gender-Filter"
          >
            {(Object.keys(GENDER_FILTER_LABELS) as GenderFilter[]).map((value) => (
              <option key={value} value={value}>
                {value === 'all' ? 'Alle Gender' : GENDER_FILTER_LABELS[value]}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={originFilter}
            onChange={(event) => setOriginFilter(event.target.value as EntryOrigin)}
            aria-label="Herkunft"
          >
            {ENTRY_ORIGINS.map((value) => (
              <option key={value} value={value}>
                {ENTRY_ORIGIN_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        {deletedCount > 0 ? (
          <label className="muted flex items-center gap-2">
            <input
              type="checkbox"
              className="rounded border-line bg-surface-1 text-marry focus:ring-marry"
              checked={showDeleted}
              onChange={(event) => setShowDeleted(event.target.checked)}
            />
            Gelöschte anzeigen ({deletedCount})
          </label>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={entries.length === 0 ? 'Noch keine Einträge' : 'Nichts gefunden'}
          description={
            entries.length === 0
              ? 'Leg ein paar Namen an — mit Foto oder als Liste auf einmal.'
              : 'Andere Suche oder andere Filter probieren.'
          }
          actionHref={entries.length === 0 ? '/entries/new' : undefined}
          actionLabel={entries.length === 0 ? 'Ersten Eintrag anlegen' : undefined}
        />
      ) : (
        <ul className="space-y-2">
          {visible.map((entry) => {
            const entryCategories = (categoryIdsByEntry.get(entry.id) ?? [])
              .map((id) => categoryById.get(id))
              .filter((category): category is CategoryRecord => Boolean(category));
            const played = stats.get(entry.id)?.shown ?? 0;

            return (
              <li key={entry.id} className="card flex items-center gap-3 p-3">
                <EntryAvatar
                  name={entry.name}
                  photoBlobId={entry.photoBlobId}
                  className="h-12 w-12 shrink-0 rounded-full text-3xl"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{entry.name}</span>
                    {entry.isCelebrity ? (
                      <span className="chip border border-line text-dim">Promi</span>
                    ) : null}
                  </div>
                  <div className="muted flex flex-wrap items-center gap-x-2">
                    <span>{GENDER_FILTER_LABELS[entry.gender]}</span>
                    {played > 0 ? <span>· {played}× gespielt</span> : null}
                  </div>
                  {entryCategories.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {entryCategories.map((category) => (
                        <span
                          key={category.id}
                          className="chip text-white"
                          style={{ backgroundColor: category.color }}
                        >
                          {category.name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                {entry.deletedAt ? (
                  <Button variant="secondary" size="sm" onClick={() => void handleRestore(entry)}>
                    Wiederherstellen
                  </Button>
                ) : (
                  <div className="flex shrink-0 gap-1">
                    <Link
                      href={`/entries/${entry.id}/edit`}
                      className="rounded-xl px-3 py-1.5 text-sm font-semibold text-dim transition hover:bg-surface-2 hover:text-ink"
                    >
                      Bearbeiten
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => void handleDelete(entry)}>
                      Löschen
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
