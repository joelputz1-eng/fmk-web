'use client';

import { useState } from 'react';
import type { EntryRecord, Verdict } from '@/lib/db/schema';
import { VERDICT_THEME } from './verdictTheme';

/**
 * Eine Aktion pro Runde genau einmal. Zuweisen per Tap (Karte wählen → Zone
 * tippen) oder per Drag auf die Zone. Was ein Tap konkret bedeutet, entscheidet
 * die Seite — die Zone meldet nur das Ereignis.
 */
export function ActionZone({
  verdict,
  label,
  assigned,
  armed,
  onTap,
  onDropEntry,
}: {
  verdict: Verdict;
  label: string;
  assigned: EntryRecord | null;
  /** true = eine Karte ist gewählt, ein Tap würde sie hier ablegen. */
  armed: boolean;
  onTap: () => void;
  onDropEntry: (entryId: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const theme = VERDICT_THEME[verdict];

  return (
    <button
      type="button"
      onClick={onTap}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        const entryId = event.dataTransfer.getData('text/plain');
        if (entryId) onDropEntry(entryId);
      }}
      aria-label={
        assigned ? `${label}: ${assigned.name}. Tippen zum Aufheben.` : `${label} zuweisen`
      }
      className={`flex min-h-[5.5rem] flex-1 flex-col items-center justify-center gap-1 rounded-2xl border-2 px-2 py-4 transition
        ${theme.border} ${assigned ? theme.tintStrong : theme.tint}
        ${dragOver || armed ? `ring-2 ${theme.ring} scale-[1.03]` : ''}`}
    >
      <span className={`display text-2xl sm:text-3xl ${theme.text}`}>{label}</span>
      {assigned ? (
        <span className="line-clamp-1 max-w-full text-xs font-semibold text-ink">
          {assigned.name}
        </span>
      ) : (
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-dim">frei</span>
      )}
    </button>
  );
}
