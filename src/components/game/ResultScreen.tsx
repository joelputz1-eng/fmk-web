'use client';

import { EntryAvatar } from '@/components/entry/EntryAvatar';
import { Button } from '@/components/ui/Button';
import { VERDICTS, type EntryRecord, type Verdict } from '@/lib/db/schema';
import { STAMP_ROTATION, VERDICT_THEME } from './verdictTheme';

/**
 * Der Reveal ist der emotionale Höhepunkt der Runde — hier und nur hier wird
 * das Design laut: das Urteil wird auf jedes Gesicht gestempelt, versetzt
 * nacheinander, mit leichtem Überschwingen.
 */
export function ResultScreen({
  entriesByVerdict,
  labels,
  roundNumber,
  onNext,
  onFinish,
}: {
  entriesByVerdict: Record<Verdict, EntryRecord>;
  labels: Record<Verdict, string>;
  roundNumber: number;
  onNext: () => void;
  onFinish: () => void;
}) {
  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow mb-2">Runde {roundNumber}</p>
        <h1 className="display text-5xl sm:text-6xl">Urteil</h1>
        <div className="spine mt-4 rounded-full" />
      </header>

      <ul className="space-y-4">
        {VERDICTS.map((verdict, index) => {
          const entry = entriesByVerdict[verdict];
          const theme = VERDICT_THEME[verdict];
          const delay = `${index * 140}ms`;

          return (
            <li
              key={verdict}
              style={{ animationDelay: delay }}
              className={`card rise relative flex items-center gap-4 overflow-hidden p-5 ${theme.tint} ${theme.border}`}
            >
              <EntryAvatar
                name={entry.name}
                photoBlobId={entry.photoBlobId}
                className="h-16 w-16 shrink-0 rounded-full text-4xl sm:h-20 sm:w-20 sm:text-5xl"
              />

              <div className="min-w-0 flex-1 pr-24 sm:pr-36">
                <p className="eyebrow mb-1">{labels[verdict]}</p>
                <p className="truncate text-xl font-bold sm:text-2xl">{entry.name}</p>
              </div>

              <span
                aria-hidden
                style={
                  {
                    '--stamp-rot': STAMP_ROTATION[verdict],
                    animationDelay: `calc(${delay} + 160ms)`,
                  } as React.CSSProperties
                }
                className={`stamp pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 rounded-lg border-[3px] p-[3px] opacity-90 ${theme.text} ${theme.border}`}
              >
                <span className="display block rounded-sm border border-current px-2.5 py-1 text-xl sm:px-4 sm:text-3xl">
                  {labels[verdict]}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-3">
        <Button size="lg" onClick={onNext}>
          Nächste Runde
        </Button>
        <Button size="lg" variant="secondary" onClick={onFinish}>
          Beenden
        </Button>
      </div>
    </div>
  );
}
