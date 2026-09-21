'use client';

import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { EntryAvatar } from '@/components/entry/EntryAvatar';
import type { EntryRecord, Verdict } from '@/lib/db/schema';
import { beginDrag, endDrag, moveDrag, type DragState } from '@/lib/game/dragAssignment';
import { VERDICT_THEME } from './verdictTheme';

export function RoundCard({
  entry,
  selected,
  verdict,
  verdictLabel,
  dragging,
  onSelect,
  onDragChange,
  onAssign,
}: {
  entry: EntryRecord;
  selected: boolean;
  verdict: Verdict | null;
  verdictLabel: string | null;
  /** true = diese Karte wird gerade gezogen, das Abbild haengt am Zeiger. */
  dragging: boolean;
  onSelect: () => void;
  /** Laufender Gestenzustand, null sobald sie vorbei ist. */
  onDragChange: (state: DragState | null) => void;
  onAssign: (verdict: Verdict) => void;
}) {
  const theme = verdict ? VERDICT_THEME[verdict] : null;

  const drag = useRef<DragState | null>(null);
  /**
   * Nach einem Pointer-Up feuert der Browser zusaetzlich ein click. Ohne diese
   * Sperre wuerde jede Geste doppelt zaehlen. Tastatur-Aktivierung kommt ohne
   * vorheriges pointerdown an und bleibt damit unberuehrt.
   */
  const swallowClick = useRef(false);

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    // Nur der primaere Zeiger, und bei der Maus nur die linke Taste.
    if (!event.isPrimary) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    // Capture haelt die Ereignisse bei der Karte, auch wenn der Finger sie
    // verlaesst. Schlaegt es fehl (Zeiger schon weg), ist das kein Grund, die
    // Geste abzusagen — sie laeuft dann nur ohne Capture.
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // absichtlich still
    }
    drag.current = beginDrag(entry.id, event.pointerId, event.clientX, event.clientY);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const next = moveDrag(current, event.clientX, event.clientY);
    if (next === current) return;
    drag.current = next;
    onDragChange(next);
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    drag.current = null;
    swallowClick.current = true;
    const outcome = endDrag(current, event.clientX, event.clientY);
    onDragChange(null);
    if (outcome.kind === 'tap') onSelect();
    else if (outcome.kind === 'assign') onAssign(outcome.verdict);
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    drag.current = null;
    swallowClick.current = true;
    onDragChange(null);
  };

  return (
    <button
      type="button"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClick={() => {
        if (swallowClick.current) {
          swallowClick.current = false;
          return;
        }
        onSelect();
      }}
      aria-pressed={selected}
      /*
       * touch-none: sonst gewinnt das Scrollen die Geste, bevor der erste
       * pointermove ankommt. select-none und das WebKit-Callout unterdruecken
       * die Textauswahl bzw. das Lupen-Menue beim laengeren Halten.
       */
      className={`card flex w-full cursor-grab touch-none select-none flex-col items-center gap-1.5 p-2.5 text-center transition
        [-webkit-touch-callout:none] active:cursor-grabbing sm:gap-4 sm:p-5
        ${dragging ? 'opacity-40' : ''}
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
        /*
         * Beide Wege gehen ueberall — die schmale Spalte bekommt nur die
         * kuerzere Schreibweise, nicht die halbe Wahrheit.
         */
        <span className="eyebrow leading-none tracking-[0.08em] sm:tracking-[0.22em]">
          <span className="sm:hidden">{selected ? 'Wählen' : 'Tippen · Ziehen'}</span>
          <span className="hidden sm:inline">
            {selected ? 'Aktion wählen' : 'Tippen oder ziehen'}
          </span>
        </span>
      )}
    </button>
  );
}
