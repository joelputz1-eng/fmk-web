'use client';

import { useState } from 'react';
import { EntryAvatar } from '@/components/entry/EntryAvatar';
import { VERDICT_THEME } from '@/components/game/verdictTheme';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';
import type { EntryRecord, RoundItemRecord, RoundRecord, Verdict } from '@/lib/db/schema';
import { DeletedTag } from './DeletedTag';

/** Nachladen in Schritten statt alles auf einmal — bei 300 Runden sonst 900 Zeilen. */
const PAGE_SIZE = 25;

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

/** Chronologischer Rundenverlauf (FEATURES.md 1.6). Neueste Runde zuerst. */
export function Chronicle({
  rounds,
  itemsByRound,
  entriesById,
  labels,
}: {
  rounds: RoundRecord[];
  itemsByRound: Map<string, RoundItemRecord[]>;
  entriesById: Map<string, EntryRecord>;
  labels: Record<Verdict, string>;
}) {
  const [visible, setVisible] = useState(PAGE_SIZE);

  if (rounds.length === 0) {
    return (
      <EmptyState
        title="Noch keine Runde"
        description="Sobald du gespielt hast, steht hier jede Runde mit ihrem Urteil."
        actionHref="/play"
        actionLabel="Runde spielen"
      />
    );
  }

  const shown = rounds.slice(0, visible);

  return (
    <div className="space-y-4">
      <ol className="space-y-3">
        {shown.map((round) => {
          const items = itemsByRound.get(round.id) ?? [];
          return (
            <li key={round.id} className="card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="eyebrow">
                  {new Date(round.playedAt).toLocaleString('de-DE', DATE_FORMAT)}
                </p>
                <p className="muted min-w-0 truncate">{round.poolDescriptor}</p>
              </div>

              <ul className="mt-3 space-y-2">
                {items.map((item) => {
                  const entry = entriesById.get(item.entryId);
                  const theme = VERDICT_THEME[item.verdict];
                  const isDeleted = entry ? entry.deletedAt !== null : false;

                  return (
                    <li key={item.id} className="flex items-center gap-3">
                      <EntryAvatar
                        name={entry?.name ?? '?'}
                        photoBlobId={entry?.photoBlobId}
                        className={`h-8 w-8 shrink-0 rounded-full text-lg ${
                          isDeleted ? 'opacity-50' : ''
                        }`}
                      />
                      <span
                        className={`min-w-0 flex-1 truncate text-sm ${
                          isDeleted ? 'text-dim' : 'text-ink'
                        }`}
                      >
                        {/* Entry weg heisst hart entfernt — soll nicht vorkommen, bricht aber nichts. */}
                        {entry?.name ?? 'Unbekannt'}
                        {isDeleted ? <DeletedTag /> : null}
                      </span>
                      <span className={`chip shrink-0 ${theme.tint} ${theme.text}`}>
                        {labels[item.verdict]}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>

      {visible < rounds.length ? (
        <div className="flex flex-col items-center gap-2">
          <Button variant="secondary" onClick={() => setVisible((count) => count + PAGE_SIZE)}>
            Mehr laden
          </Button>
          <p className="eyebrow">
            {shown.length} von {rounds.length}
          </p>
        </div>
      ) : null}
    </div>
  );
}
