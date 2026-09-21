'use client';

import { useMemo, useState } from 'react';
import { EntryAvatar } from '@/components/entry/EntryAvatar';
import { VERDICT_THEME } from '@/components/game/verdictTheme';
import { EmptyState } from '@/components/ui/Feedback';
import type { Verdict } from '@/lib/db/schema';
import {
  MIN_APPEARANCES,
  VERDICT_ORDER,
  findMostPolarising,
  findNeverMarried,
  formatShare,
  rankBy,
  type EntryStats,
} from '@/lib/stats/leaderboard';
import { DeletedTag } from './DeletedTag';
import { VerdictBar } from './VerdictBar';

/**
 * Rangliste (FEATURES.md 6.2). Gerankt wird nach Quote, nicht nach absoluter
 * Zahl — die Regel selbst steht in src/lib/stats/leaderboard.ts, hier wird sie
 * nur angezeigt. Beide Zahlen stehen immer nebeneinander: eine Quote ohne ihre
 * Grundgesamtheit ist nicht nachvollziehbar.
 */
export function Leaderboard({
  stats,
  labels,
}: {
  stats: EntryStats[];
  labels: Record<Verdict, string>;
}) {
  const [sortBy, setSortBy] = useState<Verdict>('marry');

  const ranked = useMemo(() => rankBy(stats, sortBy), [stats, sortBy]);
  const neverMarried = useMemo(() => findNeverMarried(stats), [stats]);
  const polarising = useMemo(() => findMostPolarising(stats), [stats]);

  if (ranked.length === 0) {
    // Der am haeufigsten Gezogene braucht noch so viele Runden bis zur Schwelle.
    const best = stats.reduce((max, entry) => Math.max(max, entry.appearances), 0);
    const missing = MIN_APPEARANCES - best;
    return (
      <EmptyState
        title="Noch zu wenig Datenlage"
        description={
          stats.length === 0
            ? 'Hier steht eine Rangliste, sobald die erste Runde gespielt ist.'
            : `Gewertet wird ab ${MIN_APPEARANCES} Auftritten pro Person. ${
                missing === 1 ? 'Eine Runde' : `${missing} Runden`
              } fehlen noch, bis die Erste rankt.`
        }
        actionHref="/play"
        actionLabel="Runde spielen"
      />
    );
  }

  return (
    <div className="space-y-8">
      <Podium stats={stats} labels={labels} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="eyebrow">Alle ab {MIN_APPEARANCES} Auftritten</h2>
          <div className="inline-flex rounded-xl border border-line p-1">
            {VERDICT_ORDER.map((verdict) => {
              const isActive = verdict === sortBy;
              return (
                <button
                  key={verdict}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setSortBy(verdict)}
                  className={`rounded-lg px-3 py-1.5 text-sm transition ${
                    isActive
                      ? `bg-surface-2 font-semibold ${VERDICT_THEME[verdict].text}`
                      : 'text-dim hover:text-ink'
                  }`}
                >
                  {labels[verdict]}
                </button>
              );
            })}
          </div>
        </div>

        <ol className="space-y-2">
          {ranked.map((entry, index) => (
            <li key={entry.entryId} className="card p-4">
              <div className="flex items-center gap-3">
                <span className="w-5 shrink-0 font-mono text-xs text-dim">{index + 1}</span>
                <EntryAvatar
                  name={entry.name}
                  photoBlobId={entry.photoBlobId}
                  className={`h-10 w-10 shrink-0 rounded-full text-2xl ${
                    entry.isDeleted ? 'opacity-50' : ''
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate font-semibold ${entry.isDeleted ? 'text-dim' : 'text-ink'}`}
                  >
                    {entry.name}
                    {entry.isDeleted ? <DeletedTag /> : null}
                  </p>
                  <p className={`font-mono text-xs ${VERDICT_THEME[sortBy].text}`}>
                    {formatShare(entry.counts[sortBy], entry.appearances)}
                  </p>
                </div>
              </div>
              <VerdictBar stats={entry} labels={labels} className="mt-3" />
            </li>
          ))}
        </ol>
      </section>

      {neverMarried || polarising ? (
        <section className="space-y-2">
          <h2 className="eyebrow">Kuriositäten</h2>
          {neverMarried ? (
            <Curiosity
              title="Nie geheiratet"
              entry={neverMarried}
              detail={`${neverMarried.appearances} Auftritte, kein einziges ${labels.marry}`}
            />
          ) : null}
          {polarising ? (
            <Curiosity
              title="Polarisierend"
              entry={polarising}
              detail={VERDICT_ORDER.map(
                (verdict) => `${polarising.counts[verdict]}× ${labels[verdict]}`,
              ).join(' · ')}
            />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

/** Platz 1 je Urteil. Wer 0 % hat, ist kein Sieger — dann bleibt die Karte weg. */
function Podium({ stats, labels }: { stats: EntryStats[]; labels: Record<Verdict, string> }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-3">
      {VERDICT_ORDER.map((verdict) => {
        const top = rankBy(stats, verdict)[0];
        if (!top || top.counts[verdict] === 0) return null;
        const theme = VERDICT_THEME[verdict];

        return (
          <li
            key={verdict}
            className={`card flex items-center gap-3 p-4 ${theme.tint} ${theme.border}`}
          >
            <EntryAvatar
              name={top.name}
              photoBlobId={top.photoBlobId}
              className={`h-14 w-14 shrink-0 rounded-full text-3xl ${
                top.isDeleted ? 'opacity-50' : ''
              }`}
            />
            <div className="min-w-0">
              <p className={`eyebrow mb-1 ${theme.text}`}>{labels[verdict]}</p>
              <p className={`truncate font-bold ${top.isDeleted ? 'text-dim' : 'text-ink'}`}>
                {top.name}
                {top.isDeleted ? <DeletedTag /> : null}
              </p>
              <p className="muted font-mono text-xs">
                {formatShare(top.counts[verdict], top.appearances)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Curiosity({
  title,
  entry,
  detail,
}: {
  title: string;
  entry: EntryStats;
  detail: string;
}) {
  return (
    <div className="card flex items-center gap-3 px-4 py-3">
      <EntryAvatar
        name={entry.name}
        photoBlobId={entry.photoBlobId}
        className={`h-9 w-9 shrink-0 rounded-full text-xl ${entry.isDeleted ? 'opacity-50' : ''}`}
      />
      <div className="min-w-0 flex-1">
        <p className="eyebrow mb-0.5">{title}</p>
        <p className={`truncate text-sm font-semibold ${entry.isDeleted ? 'text-dim' : 'text-ink'}`}>
          {entry.name}
          {entry.isDeleted ? <DeletedTag /> : null}
        </p>
        <p className="muted font-mono text-xs">{detail}</p>
      </div>
    </div>
  );
}
