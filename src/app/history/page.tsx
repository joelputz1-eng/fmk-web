'use client';

import { useEffect, useMemo, useState } from 'react';
import { Chronicle } from '@/components/history/Chronicle';
import { Leaderboard } from '@/components/history/Leaderboard';
import { Loading, PageHeader } from '@/components/ui/Feedback';
import { listLists } from '@/lib/db/lists';
import { groupItemsByRound, loadHistory, type HistoryData } from '@/lib/db/stats';
import type { ListRecord } from '@/lib/db/schema';
import { totalTriples } from '@/lib/game/roundGenerator';
import { buildStats } from '@/lib/stats/leaderboard';
import { useVerdictLabels } from '@/lib/theme/SettingsProvider';

type Tab = 'ranking' | 'chronicle';

const TABS: { id: Tab; label: string }[] = [
  { id: 'ranking', label: 'Rangliste' },
  { id: 'chronicle', label: 'Chronik' },
];

/** Alle Runden, unabhaengig von der Liste. */
const ALL_LISTS = 'all';

export default function HistoryPage() {
  const labels = useVerdictLabels();
  const [data, setData] = useState<HistoryData | null>(null);
  const [lists, setLists] = useState<ListRecord[]>([]);
  const [tab, setTab] = useState<Tab>('ranking');
  const [listFilter, setListFilter] = useState<string>(ALL_LISTS);

  // Es wird immer der ganze Bestand geladen und in-memory gefiltert — sonst
  // wuerde jeder Filterwechsel einen neuen DB-Roundtrip kosten.
  useEffect(() => {
    Promise.all([loadHistory(), listLists()])
      .then(([history, loadedLists]) => {
        setData(history);
        setLists(loadedLists);
      })
      .catch((error) => console.error('Verlauf konnte nicht geladen werden', error));
  }, []);

  const rounds = useMemo(() => {
    if (!data) return [];
    if (listFilter === ALL_LISTS) return data.rounds;
    return data.rounds.filter((round) => round.listId === listFilter);
  }, [data, listFilter]);

  const items = useMemo(() => {
    if (!data) return [];
    if (listFilter === ALL_LISTS) return data.items;
    const roundIds = new Set(rounds.map((round) => round.id));
    return data.items.filter((item) => roundIds.has(item.roundId));
  }, [data, listFilter, rounds]);

  const stats = useMemo(() => buildStats(items, data?.entries ?? []), [items, data]);
  const itemsByRound = useMemo(() => groupItemsByRound(items), [items]);
  const entriesById = useMemo(
    () => new Map((data?.entries ?? []).map((entry) => [entry.id, entry])),
    [data],
  );

  // Nur Listen anbieten, aus denen auch wirklich gespielt wurde.
  const playedListIds = useMemo(
    () => new Set((data?.rounds ?? []).map((round) => round.listId).filter(Boolean)),
    [data],
  );
  const filterLists = lists.filter((list) => playedListIds.has(list.id));

  if (!data) return <Loading label="Lade Verlauf …" />;

  return (
    <div>
      <PageHeader
        eyebrow="Archiv"
        title="Verlauf"
        subtitle="Wer wird gewollt, wer wird gemeuchelt — und wann war das noch mal."
      />

      <div className="space-y-6">
        <section className="grid gap-3 sm:grid-cols-3">
          <div className="card px-6 py-8 text-center sm:col-span-1">
            <div className="display text-6xl sm:text-7xl">{rounds.length}</div>
            <p className="eyebrow mt-3">
              {rounds.length === 1 ? 'gespielte Runde' : 'gespielte Runden'}
            </p>
          </div>
          <div className="card flex flex-col justify-center px-6 py-8 text-center">
            <div className="display text-4xl sm:text-5xl">{stats.length}</div>
            <p className="eyebrow mt-3">
              {stats.length === 1 ? 'Eintrag im Spiel' : 'Einträge im Spiel'}
            </p>
          </div>
          <div className="card flex flex-col justify-center px-6 py-8 text-center">
            <div className="display text-4xl sm:text-5xl">{totalTriples(stats.length)}</div>
            <p className="eyebrow mt-3">mögliche Dreier</p>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Ansicht" className="inline-flex rounded-xl border border-line p-1">
            {TABS.map((item) => {
              const isActive = item.id === tab;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setTab(item.id)}
                  className={`rounded-lg px-4 py-1.5 text-sm transition ${
                    isActive ? 'bg-surface-2 font-semibold text-ink' : 'text-dim hover:text-ink'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Eigene Einträge und Promis gemischt ergeben keine sinnvolle Gesamtrangliste. */}
          {filterLists.length > 0 ? (
            <label className="flex items-center gap-2">
              <span className="eyebrow">Liste</span>
              <select
                className="input w-auto py-1.5 text-sm"
                value={listFilter}
                onChange={(event) => setListFilter(event.target.value)}
              >
                <option value={ALL_LISTS}>Alle Runden</option>
                {filterLists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        {tab === 'ranking' ? (
          <Leaderboard stats={stats} labels={labels} />
        ) : (
          <Chronicle
            rounds={rounds}
            itemsByRound={itemsByRound}
            entriesById={entriesById}
            labels={labels}
          />
        )}
      </div>
    </div>
  );
}
