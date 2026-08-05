'use client';

import { EntryAvatar } from '@/components/entry/EntryAvatar';
import type { EntryRecord, Verdict } from '@/lib/db/schema';
import { VERDICT_THEME } from './verdictTheme';

export function RoundCard({
  entry,
  selected,
  verdict,
  verdictLabel,
  onSelect,
}: {
  entry: EntryRecord;
  selected: boolean;
  verdict: Verdict | null;
  verdictLabel: string | null;
  onSelect: () => void;
}) {
  const theme = verdict ? VERDICT_THEME[verdict] : null;

  return (
    <button
      type="button"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData('text/plain', entry.id);
        event.dataTransfer.effectAllowed = 'move';
      }}
      onClick={onSelect}
      aria-pressed={selected}
      className={`card flex w-full cursor-grab flex-col items-center gap-1.5 p-2.5 text-center transition
        active:cursor-grabbing sm:gap-4 sm:p-5
        ${selected ? 'ring-2 ring-marry' : ''}
        ${theme ? `${theme.tint} ${theme.border}` : 'hover:border-dim'}`}
    >
      <EntryAvatar
        name={entry.name}
        photoBlobId={entry.photoBlobId}
        className="h-16 w-16 rounded-full text-4xl sm:h-32 sm:w-32 sm:text-7xl"
      />

      {/*
       * break-words ist Pflicht, nicht Kosmetik: in einer Drittel-Spalte wuerde
       * ein langer Name sonst die Spaltenbreite aufziehen (min-width: auto).
       */}
      <span className="line-clamp-2 break-words text-sm font-bold leading-tight sm:text-lg">
        {entry.name}
      </span>

      {verdict && theme ? (
        <span className={`display text-base ${theme.text} sm:text-xl`}>{verdictLabel}</span>
      ) : (
        /* Am Handy gibt es kein Ziehen — und in der schmalen Spalte keinen Platz dafuer. */
        <span className="eyebrow leading-none">
          <span className="sm:hidden">{selected ? 'Wählen' : 'Tippen'}</span>
          <span className="hidden sm:inline">
            {selected ? 'Aktion wählen' : 'Tippen oder ziehen'}
          </span>
        </span>
      )}
    </button>
  );
}
