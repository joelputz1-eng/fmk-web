'use client';

import { EntryAvatar } from '@/components/entry/EntryAvatar';
import type { EntryRecord } from '@/lib/db/schema';

/**
 * Das Abbild der gezogenen Karte, das am Zeiger haengt. Die echte Karte bleibt
 * im Raster stehen — sonst wuerde die Spalte in sich zusammenfallen und das
 * Layout unter dem Finger springen.
 *
 * `pointer-events-none` ist nicht optional: sonst findet das Hit-Testing per
 * `elementFromPoint` immer nur dieses Element statt der Aktionszone darunter.
 *
 * Die Zentrierung steckt im `transform` selbst, weil eine Inline-Transform jede
 * Utility-Klasse ueberschreiben wuerde.
 */
export function DragGhost({ entry, x, y }: { entry: EntryRecord; x: number; y: number }) {
  return (
    <div
      aria-hidden
      style={{ transform: `translate3d(calc(${x}px - 50%), calc(${y}px - 50%), 0)` }}
      className="card pointer-events-none fixed left-0 top-0 z-50 flex w-28 flex-col items-center gap-1.5 p-2.5
        text-center shadow-lg shadow-black/20 sm:w-36"
    >
      <EntryAvatar
        name={entry.name}
        photoBlobId={entry.photoBlobId}
        className="h-14 w-14 rounded-full text-3xl"
      />
      <span className="line-clamp-2 break-words text-xs font-bold leading-tight">{entry.name}</span>
    </div>
  );
}
