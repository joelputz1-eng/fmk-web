'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { listCategories } from '@/lib/db/categories';
import { getCategoryIdsByEntry, listEntries } from '@/lib/db/entries';
import { getList, getListEntryIds, setListMembership } from '@/lib/db/lists';
import {
  GENDER_FILTER_LABELS,
  type CategoryRecord,
  type EntryRecord,
  type GenderFilter,
  type ListRecord,
} from '@/lib/db/schema';
import {
  describePool,
  ENTRY_ORIGIN_LABELS,
  ENTRY_ORIGINS,
  MIN_POOL_SIZE,
  type EntryOrigin,
  type PoolConfig,
} from '@/lib/game/poolBuilder';
import { stashPool } from '@/lib/game/session';
import { EntryAvatar } from '@/components/entry/EntryAvatar';
import { Button } from '@/components/ui/Button';
import { EmptyState, Loading, Notice, PageHeader } from '@/components/ui/Feedback';

export default function ListDetailPage() {
  // Next 15: params-Prop ist ein Promise, in Client-Komponenten useParams() nehmen.
  const params = useParams<{ id: string }>();
  const listId = typeof params.id === 'string' ? params.id : params.id?.[0];
  const router = useRouter();

  const [list, setList] = useState<ListRecord | null>(null);
  const [entries, setEntries] = useState<EntryRecord[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [categoryIdsByEntry, setCategoryIdsByEntry] = useState<Map<string, string[]>>(new Map());
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [includeCategoryIds, setIncludeCategoryIds] = useState<string[]>([]);
  const [excludeCategoryIds, setExcludeCategoryIds] = useState<string[]>([]);
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all');
  const [origin, setOrigin] = useState<EntryOrigin>('all');

  useEffect(() => {
    if (!listId) return;
    let cancelled = false;
    Promise.all([
      getList(listId),
      listEntries(),
      listCategories(),
      getCategoryIdsByEntry(),
      getListEntryIds(listId),
    ])
      .then(([loadedList, loadedEntries, loadedCategories, links, members]) => {
        if (cancelled) return;
        setList(loadedList ?? null);
        setEntries(loadedEntries);
        setCategories(loadedCategories);
        setCategoryIdsByEntry(links);
        setMemberIds(new Set(members));
      })
      .catch((error) => console.error('Liste konnte nicht geladen werden', error))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [listId]);

  const toggleMember = useCallback(
    async (entryId: string) => {
      if (!listId) return;
      const nextMember = !memberIds.has(entryId);
      setMemberIds((current) => {
        const next = new Set(current);
        if (nextMember) next.add(entryId);
        else next.delete(entryId);
        return next;
      });
      await setListMembership(listId, entryId, nextMember);
    },
    [listId, memberIds],
  );

  const toggleFilter = (
    ids: string[],
    setIds: (next: string[]) => void,
    otherIds: string[],
    setOtherIds: (next: string[]) => void,
    categoryId: string,
  ) => {
    if (ids.includes(categoryId)) {
      setIds(ids.filter((id) => id !== categoryId));
      return;
    }
    // Eine Kategorie kann nicht gleichzeitig Include und Exclude sein.
    setOtherIds(otherIds.filter((id) => id !== categoryId));
    setIds([...ids, categoryId]);
  };

  const config: PoolConfig = useMemo(
    () => ({
      listId: listId ?? null,
      includeCategoryIds,
      excludeCategoryIds,
      genderFilter,
      origin,
    }),
    [listId, includeCategoryIds, excludeCategoryIds, genderFilter, origin],
  );

  // Live-Vorschau: exakt dieselben Regeln wie resolvePool(), nur auf schon
  // geladenen Daten, damit der Zähler ohne Roundtrip mitläuft.
  const poolEntries = useMemo(
    () =>
      entries.filter((entry) => {
        if (!memberIds.has(entry.id)) return false;
        const entryCategoryIds = categoryIdsByEntry.get(entry.id) ?? [];
        if (
          includeCategoryIds.length > 0 &&
          !includeCategoryIds.some((id) => entryCategoryIds.includes(id))
        ) {
          return false;
        }
        if (excludeCategoryIds.some((id) => entryCategoryIds.includes(id))) return false;
        if (genderFilter !== 'all' && entry.gender !== genderFilter) return false;
        if (origin === 'own' && entry.isCelebrity) return false;
        if (origin === 'celebrity' && !entry.isCelebrity) return false;
        return true;
      }),
    [
      entries,
      memberIds,
      categoryIdsByEntry,
      includeCategoryIds,
      excludeCategoryIds,
      genderFilter,
      origin,
    ],
  );

  const visibleEntries = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('de');
    if (!needle) return entries;
    return entries.filter((entry) => entry.name.toLocaleLowerCase('de').includes(needle));
  }, [entries, search]);

  if (loading) return <Loading label="Lade Liste …" />;
  if (!list) {
    return (
      <EmptyState
        title="Liste nicht gefunden"
        actionHref="/lists"
        actionLabel="Zurück zu den Listen"
      />
    );
  }

  const canStart = poolEntries.length >= MIN_POOL_SIZE;

  const startGame = () => {
    stashPool({
      config,
      descriptor: describePool(config, { listName: list.name, categories }),
    });
    router.push('/play');
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Liste"
        title={list.name}
        subtitle={`${memberIds.size} Einträge in der Liste`}
        action={
          <Link href="/lists" className="muted underline underline-offset-2">
            Alle Listen
          </Link>
        }
      />

      <section>
        <h2 className="display mb-4 text-2xl">Pool bauen</h2>
        <div className="card space-y-4 p-4">
          <div>
            <span className="field-label">Nur diese Kategorien</span>
            <CategoryFilterChips
              categories={categories}
              selectedIds={includeCategoryIds}
              accent="#10b981"
              onToggle={(id) =>
                toggleFilter(
                  includeCategoryIds,
                  setIncludeCategoryIds,
                  excludeCategoryIds,
                  setExcludeCategoryIds,
                  id,
                )
              }
            />
          </div>

          <div>
            <span className="field-label">Diese Kategorien ausschließen</span>
            <CategoryFilterChips
              categories={categories}
              selectedIds={excludeCategoryIds}
              accent="#e11d48"
              onToggle={(id) =>
                toggleFilter(
                  excludeCategoryIds,
                  setExcludeCategoryIds,
                  includeCategoryIds,
                  setIncludeCategoryIds,
                  id,
                )
              }
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="pool-gender" className="field-label">
                Gender
              </label>
              <select
                id="pool-gender"
                className="input"
                value={genderFilter}
                onChange={(event) => setGenderFilter(event.target.value as GenderFilter)}
              >
                {(Object.keys(GENDER_FILTER_LABELS) as GenderFilter[]).map((value) => (
                  <option key={value} value={value}>
                    {value === 'all' ? 'Alle Gender' : GENDER_FILTER_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="pool-origin" className="field-label">
                Herkunft
              </label>
              <select
                id="pool-origin"
                className="input"
                value={origin}
                onChange={(event) => setOrigin(event.target.value as EntryOrigin)}
              >
                {ENTRY_ORIGINS.map((value) => (
                  <option key={value} value={value}>
                    {ENTRY_ORIGIN_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="text-sm">
              <span className="text-2xl font-bold tabular-nums">{poolEntries.length}</span>{' '}
              <span className="muted">Einträge im Pool</span>
            </p>
            <Button size="lg" disabled={!canStart} onClick={startGame}>
              Spiel starten
            </Button>
          </div>

          {!canStart ? (
            <Notice tone="warning">
              Mindestens {MIN_POOL_SIZE} Einträge nötig — aktuell {poolEntries.length}. Füge unten
              Einträge zur Liste hinzu oder lockere die Filter.
            </Notice>
          ) : null}
        </div>
      </section>

      <section>
        <h2 className="display mb-4 text-2xl">Mitglieder</h2>

        {entries.length === 0 ? (
          <EmptyState
            title="Keine Einträge vorhanden"
            description="Leg zuerst ein paar Einträge an, dann kannst du sie hier zuordnen."
            actionHref="/entries/new"
            actionLabel="Eintrag anlegen"
          />
        ) : (
          <>
            <input
              className="input mb-3"
              type="search"
              placeholder="Einträge durchsuchen …"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <ul className="space-y-2">
              {visibleEntries.map((entry) => {
                const isMember = memberIds.has(entry.id);
                return (
                  <li key={entry.id}>
                    <label className="card flex cursor-pointer items-center gap-3 p-3">
                      <input
                        type="checkbox"
                        className="h-5 w-5 rounded border-line bg-surface-1 text-marry focus:ring-marry"
                        checked={isMember}
                        onChange={() => void toggleMember(entry.id)}
                      />
                      <EntryAvatar
                        name={entry.name}
                        photoBlobId={entry.photoBlobId}
                        className="h-10 w-10 shrink-0 rounded-full text-2xl"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{entry.name}</div>
                        <div className="muted">{GENDER_FILTER_LABELS[entry.gender]}</div>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

function CategoryFilterChips({
  categories,
  selectedIds,
  accent,
  onToggle,
}: {
  categories: CategoryRecord[];
  selectedIds: string[];
  accent: string;
  onToggle: (id: string) => void;
}) {
  if (categories.length === 0) return <p className="muted">Keine Kategorien vorhanden.</p>;

  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((category) => {
        const selected = selectedIds.includes(category.id);
        return (
          <button
            key={category.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onToggle(category.id)}
            className={`chip border transition-colors ${
              selected
                ? 'border-transparent text-white'
                : 'border-line text-dim hover:bg-surface-2 hover:text-ink'
            }`}
            style={selected ? { backgroundColor: accent } : undefined}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: selected ? 'rgba(255,255,255,0.85)' : category.color }}
            />
            {category.name}
          </button>
        );
      })}
    </div>
  );
}
