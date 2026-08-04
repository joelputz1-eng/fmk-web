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
      className={`card flex w-full cursor-grab flex-col items-center gap-4 p-5 text-center transition
        active:cursor-grabbing
        ${selected ? 'ring-2 ring-marry' : ''}
        ${theme ? `${theme.tint} ${theme.border}` : 'hover:border-dim'}`}
    >
      <EntryAvatar
        name={entry.name}
        photoBlobId={entry.photoBlobId}
        className="h-28 w-28 rounded-full text-7xl sm:h-32 sm:w-32"
      />

      <span className="line-clamp-2 text-lg font-bold leading-tight">{entry.name}</span>

      {verdict && theme ? (
        <span className={`display text-xl ${theme.text}`}>{verdictLabel}</span>
      ) : (
        <span className="eyebrow">{selected ? 'Aktion wählen' : 'Tippen oder ziehen'}</span>
      )}
    </button>
  );
}
